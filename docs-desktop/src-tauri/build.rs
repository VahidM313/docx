fn main() {
    println!("cargo:rerun-if-env-changed=DOCX_BUILD_COMMIT");
    tauri_build::build()
}

