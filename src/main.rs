mod epub;
mod server;

use epub::EpubBook;
use server::{create_router, AppState};
use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

const DEFAULT_BOOK_PATH: &str = "/home/taua/Downloads/relatorios_pbdoc/O conde de Monte Cristo_ edição bolso de luxo (Clássicos -- Alexandre Dumas -- 2012 -- Zahar -- 06be060fd05eebbd71b3213739e7ce7a -- Anna’s Archive.epub";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();

    let book_path = if args.len() > 1 {
        PathBuf::from(&args[1])
    } else {
        PathBuf::from(DEFAULT_BOOK_PATH)
    };

    if !book_path.exists() {
        eprintln!("Arquivo não encontrado: {}", book_path.display());
        std::process::exit(1);
    }

    println!("\x1b[38;2;181;118;20m");
    println!("  ┌─────────────────────────────────────────────────────────────┐");
    println!("  │                        OXIDEREADER                          │");
    println!("  │              Minimalist Modal EPUB/Doc Reader               │");
    println!("  └─────────────────────────────────────────────────────────────┘\x1b[0m");

    println!(" Carregando: \x1b[38;2;7;102;120m{}\x1b[0m", book_path.display());

    let book = EpubBook::open(&book_path)?;

    println!("  • Título:     \x1b[1m{}\x1b[0m", book.title);
    println!("  • Autor:      {}", book.author);
    println!("  • Idioma:     {}", book.language);
    println!("  • Capítulos:  {} seções no spine", book.spine.len());
    println!("  • Tópicos:    {} itens no índice (TOC)", book.toc.len());

    let state = Arc::new(AppState { book });
    let app = create_router(state);

    let port: u16 = 3333;
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    let url = format!("http://127.0.0.1:{}", port);
    println!("\n \x1b[38;2;121;116;14m✔ Servidor OxideReader rodando em:\x1b[0m \x1b[4;38;2;7;102;120m{}\x1b[0m", url);
    println!(" \x1b[90m(Pressione 'Tab' para índice, 'r' para recolor, 'h' para ajuda)\x1b[0m\n");

    // Try to open automatically in browser
    let _ = open::that(&url);

    axum::serve(listener, app).await?;

    Ok(())
}
