use crate::epub::EpubBook;
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Json, Router,
};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

const INDEX_HTML: &str = include_str!("assets/index.html");
const STYLE_CSS: &str = include_str!("assets/style.css");
const APP_JS: &str = include_str!("assets/app.js");

pub struct AppState {
    pub book: EpubBook,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(serve_index))
        .route("/assets/style.css", get(serve_style))
        .route("/assets/app.js", get(serve_js))
        .route("/api/book", get(get_book_metadata))
        .route("/book/*path", get(serve_book_file))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn serve_index() -> Html<&'static str> {
    Html(INDEX_HTML)
}

async fn serve_style() -> Response {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/css; charset=utf-8")],
        STYLE_CSS,
    )
        .into_response()
}

async fn serve_js() -> Response {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/javascript; charset=utf-8")],
        APP_JS,
    )
        .into_response()
}

async fn get_book_metadata(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let metadata = state.book.get_metadata();
    Json(metadata)
}

async fn serve_book_file(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
) -> Result<Response, StatusCode> {
    let bytes = state
        .book
        .read_file_raw(&path)
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let mime = mime_guess_str(&path);

    Ok((StatusCode::OK, [(header::CONTENT_TYPE, mime)], bytes).into_response())
}

fn mime_guess_str(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".html") || lower.ends_with(".htm") {
        "text/html; charset=utf-8"
    } else if lower.ends_with(".xhtml") {
        "application/xhtml+xml; charset=utf-8"
    } else if lower.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if lower.ends_with(".js") {
        "application/javascript; charset=utf-8"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".woff2") {
        "font/woff2"
    } else if lower.ends_with(".woff") {
        "font/woff"
    } else if lower.ends_with(".ttf") {
        "font/ttf"
    } else if lower.ends_with(".otf") {
        "font/otf"
    } else {
        "application/octet-stream"
    }
}
