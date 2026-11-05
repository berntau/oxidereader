# 📖 OxideReader

> Um leitor minimalista, modal (estilo Vim/Zathura) para a web, desenvolvido em **Rust** para desbravar a linguagem do zero à prática.

---

## 🎯 Visão do Projeto

O objetivo do **OxideReader** é duplo:
1. **Criar um leitor de documentos web sem distrações**: Inspirado na interface ágil do **Zathura**, com controle 100% pelo teclado, barra de status minimalista no rodapé, modo índice (`Tab`), busca incremental (`/`), comandos (`:`) e o tema **Gruvbox Light** com algoritmo de *recolor* (preservando o tom de ilustrações).
2. **Aprender Rust de forma profunda e prática**: Construir os parsers, a máquina de estados, o gerenciamento de concorrência e o servidor de leitura direto na mão, entendendo como o Rust gerencia memória, trata erros e lida com sistemas de tipos estritos sem *garbage collector*.

---

## 🎨 A Paleta: Gruvbox Light (Zathura Config)

O visual do leitor segue a configuração do Zathura:

| Elemento Zathura | Variável / Config | Valor RGBA | Hex | Papel na UI |
| :--- | :--- | :--- | :--- | :--- |
| **Fundo Padrão** | `default-bg` / `recolor-lightcolor` | `rgba(251, 241, 199, 1)` | `#fbf1c7` | Fundo principal da página |
| **Texto Padrão** | `default-fg` / `recolor-darkcolor` | `rgba(60, 56, 54, 1)` | `#3c3836` | Tipografia e texto de leitura |
| **Barra de Status** | `statusbar-bg` / `index-bg` | `rgba(213, 196, 161, 1)` | `#d5c4a1` | Rodapé e fundo do índice |
| **Texto de Status** | `statusbar-fg` / `index-fg` | `rgba(60, 56, 54, 1)` | `#3c3836` | Rótulos de página e modo |
| **Seleção Ativa** | `index-active-bg` / `completion-highlight-bg` | `rgba(7, 102, 120, 1)` | `#076678` | Item ativo no índice e autocomplete |
| **Texto da Seleção** | `index-active-fg` / `completion-highlight-fg` | `rgba(213, 196, 161, 1)` | `#d5c4a1` | Contraste sobre a seleção azul |
| **Grupo de Completar** | `completion-group-bg` | `rgba(235, 219, 178, 1)` | `#ebdbb2` | Divisores de categorias |
| **Destaque de Busca** | `highlight-color` | `rgba(181, 118, 20, 0.5)` | `#b57614` | Correspondências encontradas |
| **Destaque Ativo** | `highlight-active-color` | `rgba(175, 58, 3, 0.5)` | `#af3a03` | Ocorrência de busca focada |
| **Notificação de Erro** | `notification-error-fg` | `rgba(157, 0, 6, 1)` | `#9d0006` | Avisos de erro no status |
| **Notificação de Aviso**| `notification-warning-fg` | `rgba(181, 118, 20, 1)` | `#b57614` | Alertas de navegação |
| **Notificação Sucesso**| `notification-fg` | `rgba(121, 116, 14, 1)` | `#79740e` | Mensagens de confirmação |

---

## 🗺️ Trilha de Aprendizado Rust (Passo a Passo)

Esta trilha foi desenhada para avançar por fases modulares. Cada fase explora conceitos essenciais da linguagem aplicados diretamente ao domínio do leitor.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Fase 1: Fundamentos de I/O, Bytes e Tratamento de Erros               │
│  Fase 2: Modelagem de Dados, Structs, Enums e Parsing XML (EPUB)       │
│  Fase 3: Concorrência Segura, Async e Servidor Web com Tokio/Axum      │
│  Fase 4: A Experiência Zathura: Teclado Modal, Statusbar e Index Mode  │
│  Fase 5: O Motor de Recolor (Tone-mapping & Preservação de Cores)      │
│  Fase 6: Próximos Formatos (Kindle MOBI, PDF via WASM/PDF.js)          │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 🟢 Fase 1: Fundamentos de I/O, Bytes e Tratamento de Erros

> 📘 **[Guia passo a passo: `docs/fase-1.md`](docs/fase-1.md)** — roteiro de laboratório com previsões, quebras propositais e checkpoints.

O objetivo é entender como Rust interage com o sistema de arquivos e como funciona seu tratamento de erros estrito sem exceções (`try/catch`).

- [ ] **1.1. Entrada de argumentos da CLI**
  - Conceito: `std::env::args`, vetores (`Vec<T>`), alocação de memória na Heap.
  - Prática: Receber o caminho do arquivo `.epub` via linha de comando ou utilizar um arquivo padrão.
- [ ] **1.2. Abrindo arquivos e inspecionando metadados**
  - Conceito: `std::fs::File`, `std::path::Path`, `PathBuf` (diferença entre referências emprestadas e donos de dados).
  - Prática: Verificar se o arquivo existe e obter seu tamanho em bytes.
- [ ] **1.3. O modelo de erros do Rust (`Result<T, E>` e o operador `?`)**
  - Conceito: Por que Rust não usa exceções. Tipos `Result<T, E>` e `Option<T>`, enum `match` e propagação com `?`.
  - Prática: Criar o enum `EpubError` com a biblioteca `thiserror` para padronizar erros de I/O, descompactação e parsing.
- [ ] **1.4. Lendo o cabeçalho binário (Magic Bytes)**
  - Conceito: Leitura de fatias de bytes (`&[u8]`), buffers (`BufReader`).
  - Prática: Inspecionar os primeiros 4 bytes do arquivo para confirmar a assinatura de um arquivo ZIP (`PK\x03\x04`).

---

### 🟡 Fase 2: Modelagem de Dados, Structs e Parsing do EPUB

Um arquivo `.epub` é um container compactado (ZIP) contendo arquivos estruturados em XML e XHTML.

- [ ] **2.1. Descompactando na memória com `zip::ZipArchive`**
  - Conceito: Traits de I/O (`std::io::Read`, `std::io::Seek`), empréstimo mutável (`&mut archive`).
  - Prática: Listar todos os arquivos contidos dentro do EPUB e identificar o arquivo `META-INF/container.xml`.
- [ ] **2.2. Parsing de XML orientado a eventos com `quick-xml`**
  - Conceito: Parsing por eventos (`Event::Start`, `Event::Empty`, `Event::Text`), zero-allocation e referências de fatias (`&[u8]`).
  - Prática: Ler o `container.xml` para descobrir o caminho dinâmico do `content.opf`.
- [ ] **2.3. Modelagem de dados com Structs e Enums**
  - Conceito: `struct`, derivação de traits (`#[derive(Debug, Clone, Serialize)]`), mapeamento chave-valor com `HashMap`.
  - Prática: Definir as estruturas:
    - `ManifestItem`: armazena `id`, `href` e `media-type`.
    - `TocItem`: título do capítulo, link de destino (`href`) e filhos (árvore de tópicos).
    - `EpubBook`: guarda metadados (`title`, `author`, `language`), o diretório base (`opf_dir`), a lista de itens (`manifest`) e a ordem linear de leitura (`spine`).
- [ ] **2.4. Extração do Spine e Metadados do `content.opf`**
  - Conceito: Manipulação de strings UTF-8 (`String::from_utf8_lossy`), ciclo de vida de nós XML.
  - Prática: Extrair os metadados do livro e a lista sequencial de capítulos (`<spine>`).
- [ ] **2.5. Parsing do Índice de Conteúdo (`toc.ncx`)**
  - Conceito: Recursão em Rust, vetores aninhados e mapeamento de ponteiros lógicos.
  - Prática: Construir a árvore do índice de capítulos e associar cada tópico ao seu índice correspondente no *spine*.

---

### 🟠 Fase 3: Servindo o Conteúdo e Concorrência Segura

Como ler o livro na Web? Criando um servidor local assíncrono e leve em Rust.

- [ ] **3.1. Programação Assíncrona com `tokio` e `axum`**
  - Conceito: O modelo `async`/`await` em Rust, *tasks* cooperativas, polling e *event loops*.
  - Prática: Subir um servidor HTTP local na porta `3333`.
- [ ] **3.2. Concorrência segura: Compartilhando o livro entre requisições**
  - Conceito: `Arc<T>` (*Atomic Reference Counting*) para múltiplos donos e `Mutex<T>` (*Mutual Exclusion*) para sincronização segura entre threads sem *data races*.
  - Prática: Armazenar a instância de `EpubBook` dentro do estado compartilhado do Axum (`AppState`).
- [ ] **3.3. Servindo recursos binários e MIME Types**
  - Conceito: Respostas binárias HTTP, detecção estática de extensão e cabeçalhos `Content-Type`.
  - Prática: Criar o endpoint `/book/*path` para servir imagens (`.jpeg`, `.png`), fontes (`.woff2`) e folhas de estilo (`.css`) direto do arquivo ZIP.
- [ ] **3.4. Embutindo o Frontend no próprio binário**
  - Conceito: A macro `include_str!` do Rust para compilar assets estáticos direto dentro do executável (distribuição sem dependências externas).
  - Prática: Servir a página inicial do leitor (`/`), CSS e JavaScript sem depender de arquivos soltos em disco.

---

### 🔵 Fase 4: A Interface Zathura & Filosofia Modal

O leitor web deve replicar com fidelidade a experiência do Zathura.

- [ ] **4.1. Arquitetura da UI & Paleta Gruvbox Light**
  - Isolamento do conteúdo do livro via `<iframe>` para proteger os estilos internos da obra contra vazamentos na UI do leitor.
  - Barra de status fixa no rodapé exibindo: `[Título do Livro]`, `[Capítulo X/Y]`, `[Progresso %]`, `[Status do Recolor]` e `[MODO]`.
- [ ] **4.2. Motor de Teclado Modal (Vim Bindings)**
  - Implementação dos estados: `Normal`, `Command`, `Search` e `Index`.
  - Atalhos de navegação:
    - `j` / `k` ou setas: rolagem suave linha a linha.
    - `d` / `u`: rolagem de meia página para baixo/cima.
    - `Espaço` / `Shift+Espaço`: rolagem de página inteira.
    - `gg` / `G`: início e fim do capítulo atual.
    - `J` / `K` (ou `n` / `p`): avançar e retroceder capítulos no *spine*.
- [ ] **4.3. Modo Índice (`Index Mode` / tecla `Tab`)**
  - Ao pressionar `Tab`, um overlay com a árvore de capítulos é exibido nas cores `index-bg` (`#d5c4a1`) e `index-fg` (`#3c3836`).
  - Navegação vertical com `j`/`k`, seleção destacada com `index-active-bg` (`#076678`), pulo com `Enter` e fechamento com `Tab`/`Esc`.
- [ ] **4.3b. Painel lateral persistente (ícone *hamburger*)**
  - Alternativa a mouse para o mesmo índice: um botão ☰ abre uma *sidebar* fixa à esquerda, que permanece aberta durante a leitura (em vez do overlay modal do `Tab`).
  - Cabeçalho do painel: miniatura da capa, título e autor — todos já disponíveis nos metadados do `content.opf` extraídos na fase 2.4.
  - Lista de capítulos a partir da árvore `TocItem` da fase 2.5, com itens pais recolhíveis (seta ▶) para livros em múltiplas partes e realce do capítulo atual.
  - Decisões de layout a definir: empurrar o conteúdo ou sobrepor; largura redimensionável; persistir aberto/fechado no `localStorage` junto das preferências do item 4.6.
- [ ] **4.4. Barra de Comandos (`:`) e Autocomplete**
  - Ao pressionar `:`, a barra de comandos é ativada no rodapé.
  - Comandos suportados:
    - `:goto <n>` ou `:page <n>`: salta para o capítulo `n`.
    - `:toc`: abre o índice.
    - `:recolor`: alterna o filtro de cores.
    - `:font <size>`: ajusta o tamanho da fonte de leitura.
    - `:help`: exibe os atalhos disponíveis.
- [ ] **4.5. Busca Textual Incremental (`/`)**
  - Busca rápida de termos dentro do capítulo renderizado, com realce usando a cor `--highlight-color`.
  - Navegação entre ocorrências com `n` (próxima) e `N` (anterior).
- [ ] **4.6. Persistência de Leitura**
  - Armazenar capítulo atual, tamanho da fonte e preferência de recolor no `localStorage` do navegador para nunca perder a posição entre sessões.

---

### 🟣 Fase 5: O Recurso de Recolor com Preservação de Matiz

O recurso mais celebrado do Zathura: ler no tema Gruvbox Light preservando as cores originais de capas e imagens ilustrativas.

- [ ] **5.1. O Algoritmo de Tone-Mapping**
  - Mapear a luminância dos textos para `rgba(60, 56, 54, 1)` e do fundo para `rgba(251, 241, 199, 1)`.
- [ ] **5.2. Preservação de Imagens (`keephue = true`)**
  - Aplicar regras CSS e filtros gráficos de contraste e mesclagem (`multiply`) para garantir que diagramas, gravuras e pinturas do livro mantenham suas cores naturais sem inversão negativa indesejada.

---

### 🔴 Fase 6: Próximos Desafios & Extensões

- [ ] **6.1. Suporte a MOBI / Kindle (AZW3)**: Escrever o parser do formato binário PalmDOC e blocos comprimidos Huff/CDIC em Rust puro.
- [ ] **6.2. Suporte a PDF**: Renderizar páginas no `<canvas>` aplicando os shaders do Zathura.
- [ ] **6.3. Marcadores e Anotações**: Sistema local de bookmarks persistido em SQLite ou arquivo JSON em `~/.config/zathura-web/`.

---

## 🚀 Como Executar

### Pré-requisitos
* Compilador **Rust** e **Cargo** (versão 1.80+ recomendada).

### Rodando o projeto
```bash
# Clone o repositório
git clone git@github.com:berntau/OxideReader.git
cd OxideReader

# Execute apontando para o seu arquivo EPUB
cargo run -- "/caminho/para/seu/livro.epub"
```

O servidor iniciará automaticamente em `http://127.0.0.1:3333` e abrirá seu navegador padrão.

---

## ⌨️ Tabela Rápida de Atalhos

| Tecla | Ação |
| :--- | :--- |
| `j` / `k` | Rolar para baixo / cima |
| `d` / `u` | Meia página para baixo / cima |
| `Espaço` / `b` | Página inteira para baixo / cima |
| `gg` / `G` | Início / Fim do capítulo |
| `J` / `K` (ou `n` / `p`) | Próximo capítulo / Capítulo anterior |
| `Tab` | Abrir / Fechar Índice de Capítulos (TOC) |
| `r` | Ligar / Desligar modo Recolor Gruvbox |
| `+` / `-` / `0` | Aumentar / Diminuir / Resetar tamanho da fonte |
| `:` | Linha de comando (`:goto`, `:toc`, `:font`, etc.) |
| `/` | Buscar termo no capítulo atual |
| `h` ou `?` | Abrir janela de ajuda |
| `Esc` | Fechar modais / Cancelar comandos |
