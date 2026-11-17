const botaoMenu = document.querySelector(".nav-abrir");
const menu = document.querySelector(".menu");

botaoMenu.addEventListener("click", () => {
    const aberto = menu.classList.toggle("aberto");
    botaoMenu.setAttribute("aria-expanded", String(aberto));
});

document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && menu.classList.contains("aberto")) {
        menu.classList.remove("aberto");
        botaoMenu.setAttribute("aria-expanded", "false");
        botaoMenu.focus();
    }
});
