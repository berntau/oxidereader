use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use zip::ZipArchive;

#[derive(Debug, thiserror::Error)]
pub enum EpubError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("ZIP error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("XML parsing error: {0}")]
    Xml(#[from] quick_xml::Error),
    #[error("Format error: {0}")]
    Format(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TocItem {
    pub title: String,
    pub href: String,
    pub spine_index: Option<usize>,
    pub children: Vec<TocItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestItem {
    pub id: String,
    pub href: String,
    pub media_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpineItemInfo {
    pub index: usize,
    pub id: String,
    pub href: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMetadata {
    pub title: String,
    pub author: String,
    pub language: String,
    pub spine_count: usize,
    pub spine: Vec<SpineItemInfo>,
    pub toc: Vec<TocItem>,
}

pub struct EpubBook {
    #[allow(dead_code)]
    pub path: PathBuf,
    pub title: String,
    pub author: String,
    pub language: String,
    pub opf_dir: String,
    pub manifest: HashMap<String, ManifestItem>,
    pub spine: Vec<String>, // Manifest IDs in order
    pub toc: Vec<TocItem>,
    archive: Mutex<ZipArchive<BufReader<File>>>,
}

impl EpubBook {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, EpubError> {
        let path = path.as_ref().to_path_buf();
        let file = File::open(&path)?;
        let mut archive = ZipArchive::new(BufReader::new(file))?;

        // 1. Locate OPF file path from META-INF/container.xml
        let opf_path = Self::find_opf_path(&mut archive)?;
        let opf_dir = if let Some(idx) = opf_path.rfind('/') {
            opf_path[..idx + 1].to_string()
        } else {
            String::new()
        };

        // 2. Read and parse OPF file
        let opf_content = {
            let mut file = archive.by_name(&opf_path)?;
            let mut content = String::new();
            file.read_to_string(&mut content)?;
            content
        };

        let (title, author, language, manifest, spine, toc_id) =
            Self::parse_opf(&opf_content)?;

        // 3. Parse TOC (NCX or EPUB3 nav)
        let mut toc = Vec::new();
        if let Some(toc_id) = toc_id {
            if let Some(toc_item) = manifest.get(&toc_id) {
                let ncx_full_path = format!("{}{}", opf_dir, toc_item.href);
                if let Ok(mut ncx_file) = archive.by_name(&ncx_full_path) {
                    let mut ncx_content = String::new();
                    if ncx_file.read_to_string(&mut ncx_content).is_ok() {
                        toc = Self::parse_ncx(&ncx_content, &opf_dir);
                    }
                }
            }
        }

        // Map spine indices to TOC items
        Self::map_spine_indices(&mut toc, &spine, &manifest, &opf_dir);

        Ok(Self {
            path,
            title,
            author,
            language,
            opf_dir,
            manifest,
            spine,
            toc,
            archive: Mutex::new(archive),
        })
    }

    fn find_opf_path(archive: &mut ZipArchive<BufReader<File>>) -> Result<String, EpubError> {
        let mut container_file = archive
            .by_name("META-INF/container.xml")
            .map_err(|_| EpubError::Format("Missing META-INF/container.xml".into()))?;

        let mut content = String::new();
        container_file.read_to_string(&mut content)?;

        let mut reader = Reader::from_str(&content);
        reader.config_mut().trim_text(true);

        loop {
            match reader.read_event()? {
                Event::Start(e) | Event::Empty(e) if e.name().as_ref() == b"rootfile" => {
                    for attr in e.attributes() {
                        let attr = attr.map_err(quick_xml::Error::InvalidAttr)?;
                        if attr.key.as_ref() == b"full-path" {
                            let path = String::from_utf8_lossy(&attr.value).to_string();
                            return Ok(path);
                        }
                    }
                }
                Event::Eof => break,
                _ => {}
            }
        }

        Err(EpubError::Format("No rootfile in container.xml".into()))
    }

    fn parse_opf(
        xml: &str,
    ) -> Result<
        (
            String,
            String,
            String,
            HashMap<String, ManifestItem>,
            Vec<String>,
            Option<String>,
        ),
        EpubError,
    > {
        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

        let mut title = "Untitled".to_string();
        let mut author = "Unknown Author".to_string();
        let mut language = "en".to_string();
        let mut manifest = HashMap::new();
        let mut spine = Vec::new();
        let mut toc_id = None;

        let mut current_tag = Vec::new();

        loop {
            match reader.read_event()? {
                Event::Start(e) => {
                    let name = e.name().as_ref().to_vec();
                    if name == b"spine" {
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                if attr.key.as_ref() == b"toc" {
                                    toc_id = Some(String::from_utf8_lossy(&attr.value).to_string());
                                }
                            }
                        }
                    }
                    current_tag.push(name);
                }
                Event::Empty(e) => {
                    let name = e.name().as_ref().to_vec();
                    if name == b"item" {
                        let mut id = String::new();
                        let mut href = String::new();
                        let mut media_type = String::new();

                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                match attr.key.as_ref() {
                                    b"id" => id = String::from_utf8_lossy(&attr.value).to_string(),
                                    b"href" => {
                                        href = String::from_utf8_lossy(&attr.value).to_string()
                                    }
                                    b"media-type" => {
                                        media_type =
                                            String::from_utf8_lossy(&attr.value).to_string()
                                    }
                                    _ => {}
                                }
                            }
                        }
                        if !id.is_empty() {
                            manifest.insert(
                                id.clone(),
                                ManifestItem {
                                    id,
                                    href,
                                    media_type,
                                },
                            );
                        }
                    } else if name == b"itemref" {
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                if attr.key.as_ref() == b"idref" {
                                    spine.push(String::from_utf8_lossy(&attr.value).to_string());
                                }
                            }
                        }
                    }
                }
                Event::Text(e) => {
                    if let Some(tag) = current_tag.last() {
                        let text = e.unescape()?.trim().to_string();
                        if !text.is_empty() {
                            if tag.ends_with(b"title") {
                                title = text;
                            } else if tag.ends_with(b"creator") {
                                author = text;
                            } else if tag.ends_with(b"language") {
                                language = text;
                            }
                        }
                    }
                }
                Event::End(_) => {
                    current_tag.pop();
                }
                Event::Eof => break,
                _ => {}
            }
        }

        Ok((title, author, language, manifest, spine, toc_id))
    }

    fn parse_ncx(xml: &str, _opf_dir: &str) -> Vec<TocItem> {
        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

        let mut items = Vec::new();
        let mut current_title = String::new();
        let mut current_src = String::new();
        let mut inside_label = false;

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) => match e.name().as_ref() {
                    b"navLabel" => inside_label = true,
                    _ => {}
                },
                Ok(Event::Empty(e)) => {
                    if e.name().as_ref() == b"content" {
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                if attr.key.as_ref() == b"src" {
                                    current_src = String::from_utf8_lossy(&attr.value).to_string();
                                }
                            }
                        }
                    }
                }
                Ok(Event::Text(e)) => {
                    if inside_label {
                        if let Ok(txt) = e.unescape() {
                            let trimmed = txt.trim();
                            if !trimmed.is_empty() {
                                current_title = trimmed.to_string();
                            }
                        }
                    }
                }
                Ok(Event::End(e)) => match e.name().as_ref() {
                    b"navLabel" => inside_label = false,
                    b"navPoint" => {
                        if !current_title.is_empty() || !current_src.is_empty() {
                            items.push(TocItem {
                                title: std::mem::take(&mut current_title),
                                href: std::mem::take(&mut current_src),
                                spine_index: None,
                                children: Vec::new(),
                            });
                        }
                    }
                    _ => {}
                },
                Ok(Event::Eof) | Err(_) => break,
                _ => {}
            }
        }

        items
    }

    fn map_spine_indices(
        toc: &mut [TocItem],
        spine: &[String],
        manifest: &HashMap<String, ManifestItem>,
        opf_dir: &str,
    ) {
        let mut href_to_spine = HashMap::new();
        for (idx, idref) in spine.iter().enumerate() {
            if let Some(item) = manifest.get(idref) {
                let full = format!("{}{}", opf_dir, item.href);
                href_to_spine.insert(full.clone(), idx);
                href_to_spine.insert(item.href.clone(), idx);
            }
        }

        for item in toc.iter_mut() {
            let base_href = item.href.split('#').next().unwrap_or(&item.href);
            if let Some(&idx) = href_to_spine.get(base_href) {
                item.spine_index = Some(idx);
            }
        }
    }

    pub fn read_file_raw(&self, file_path: &str) -> Result<Vec<u8>, EpubError> {
        let mut archive = self
            .archive
            .lock()
            .map_err(|_| EpubError::Format("Failed to lock zip archive".into()))?;

        let clean = file_path.trim_start_matches('/').trim_start_matches("./");

        // 1. Direct lookup
        if let Ok(mut entry) = archive.by_name(clean) {
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            return Ok(buf);
        }

        // 2. Try with opf_dir prefix
        if !self.opf_dir.is_empty() {
            let prefixed = format!("{}{}", self.opf_dir, clean);
            if let Ok(mut entry) = archive.by_name(&prefixed) {
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf)?;
                return Ok(buf);
            }
        }

        // 3. Fallback scan by endswith
        for i in 0..archive.len() {
            if let Ok(mut entry) = archive.by_index(i) {
                let name = entry.name().to_string();
                if name == clean || name.ends_with(clean) {
                    let mut buf = Vec::new();
                    entry.read_to_end(&mut buf)?;
                    return Ok(buf);
                }
            }
        }

        Err(EpubError::Format(format!("File not found in epub: {}", file_path)))
    }

    pub fn get_metadata(&self) -> BookMetadata {
        let spine_info = self
            .spine
            .iter()
            .enumerate()
            .map(|(index, id)| {
                let href = self
                    .manifest
                    .get(id)
                    .map(|item| format!("{}{}", self.opf_dir, item.href))
                    .unwrap_or_default();
                SpineItemInfo {
                    index,
                    id: id.clone(),
                    href,
                }
            })
            .collect();

        BookMetadata {
            title: self.title.clone(),
            author: self.author.clone(),
            language: self.language.clone(),
            spine_count: self.spine.len(),
            spine: spine_info,
            toc: self.toc.clone(),
        }
    }

    #[allow(dead_code)]
    pub fn get_spine_href(&self, spine_index: usize) -> Result<String, EpubError> {
        let idref = self
            .spine
            .get(spine_index)
            .ok_or_else(|| EpubError::Format(format!("Invalid spine index: {}", spine_index)))?;

        let item = self
            .manifest
            .get(idref)
            .ok_or_else(|| EpubError::Format(format!("Spine item {} not in manifest", idref)))?;

        Ok(format!("{}{}", self.opf_dir, item.href))
    }
}
