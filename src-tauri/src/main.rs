// Sem janela de console no executável final.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ilha_lib::run()
}
