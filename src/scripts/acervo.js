import { livrosIniciais } from "../data/livros.js";

const $ = id => document.getElementById(id);
const mobile = window.matchMedia("(max-width: 767px)");
const normalizar = valor => String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const criar = (tag, classe, conteudo) => {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (conteudo !== undefined) elemento.textContent = conteudo;
    return elemento;
};
const livros = livrosIniciais.map(livro => ({ ...livro }));
let pagina = 1;
let destaque = 0;

function criarCapa(livro) {
    const capa = criar("div", "capa");
    capa.setAttribute("aria-hidden", "true");
    capa.append(criar("span", "capa-titulo", livro.titulo));
    return capa;
}

function preencherFiltros() {
    for (const campo of ["categoria", "editora"]) {
        const seletor = $(campo);
        const anterior = seletor.value;
        const opcoes = [...new Set(livros.map(livro => livro[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        seletor.replaceChildren(new Option(campo === "categoria" ? "Gênero" : "Editora", ""));
        opcoes.forEach(valor => seletor.add(new Option(valor, valor)));
        if (livros.some(livro => !livro[campo])) seletor.add(new Option("Não informado", "__nao_informado"));
        if ([...seletor.options].some(opcao => opcao.value === anterior)) seletor.value = anterior;
    }
}

function filtrados() {
    const termo = normalizar($("busca").value);
    return livros.filter(livro => (!termo || normalizar(`${livro.titulo} ${livro.autor}`).includes(termo)) &&
        ["categoria", "editora"].every(campo => !$(campo).value || ($(campo).value === "__nao_informado" ? !livro[campo] : livro[campo] === $(campo).value)));
}

function renderizarCatalogo() {
    const lista = filtrados();
    const porPagina = mobile.matches ? 8 : 15;
    const total = Math.max(1, Math.ceil(lista.length / porPagina));
    pagina = Math.min(Math.max(1, pagina), total);
    const inicio = (pagina - 1) * porPagina;
    $("grade-livros").replaceChildren(...lista.slice(inicio, inicio + porPagina).map(livro => {
        const artigo = criar("article", "livro");
        const botao = criar("div", "livro-capa");
        botao.setAttribute("aria-label", livro.titulo);
        botao.append(criarCapa(livro));
        artigo.append(botao);
        return artigo;
    }));
    $("resultados").textContent = lista.length ? `Exibindo ${inicio + 1}–${Math.min(inicio + porPagina, lista.length)} de ${lista.length} ${lista.length === 1 ? "livro" : "livros"}` : "Nenhum livro encontrado";
    $("vazio").hidden = lista.length > 0;
    $("grade-livros").hidden = lista.length === 0;
    $("adicionar").classList.toggle("sem-resultados", lista.length === 0);
    $("limpar-busca").hidden = !$("busca").value && !$("categoria").value && !$("editora").value;
    const nav = $("paginacao");
    nav.replaceChildren();
    nav.hidden = lista.length === 0;
    function adicionarPagina(numero, rotulo, classe, desativado = false) {
        const botao = criar("button", classe, rotulo);
        botao.disabled = desativado;
        botao.setAttribute("aria-label", classe === "pagina" ? `Página ${numero}` : rotulo === "‹" ? "Página anterior" : "Próxima página");
        if (classe === "pagina" && numero === pagina) botao.setAttribute("aria-current", "page");
        botao.addEventListener("click", () => {
            pagina = numero;
            renderizarCatalogo();
            $("catalogo").scrollIntoView({ block: "start" });
            nav.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
        });
        nav.append(botao);
    }
    adicionarPagina(pagina - 1, "‹", "seta", pagina === 1);
    const primeira = Math.max(1, Math.min(pagina - 1, total - 2));
    for (let numero = primeira; numero <= Math.min(total, primeira + 2); numero++) adicionarPagina(numero, String(numero), "pagina");
    adicionarPagina(pagina + 1, "›", "seta", pagina === total);
}

function livrosEmDestaque() {
    const ordem = ["figma-1", "figma-3", "figma-4", "figma-5", "figma-2"];
    const originais = ordem.map(id => livros.find(livro => livro.id === id)).filter(Boolean);
    return [...originais, ...livros.filter(livro => !ordem.includes(livro.id))].slice(0, 5);
}

function selecionarDestaque(indice) {
    const lista = livrosEmDestaque();
    destaque = indice;
    const livro = lista[indice];
    $("destaque-titulo").textContent = livro?.titulo || "";
    $("destaque-autor").textContent = livro ? [livro.autor, livro.anoDestaque || livro.ano].filter(Boolean).join(" - ") : "";
    $("destaque-livros").querySelectorAll("button").forEach((botao, i) => {
        botao.classList.toggle("ativo", i === indice);
        botao.setAttribute("aria-expanded", String(i === indice));
    });
}

function renderizarDestaques() {
    const lista = livrosEmDestaque();
    destaque = Math.min(destaque, Math.max(0, lista.length - 1));
    $("destaque-livros").replaceChildren(...lista.map((livro, i) => {
        const botao = criar("button", "destaque-livro");
        botao.type = "button";
        botao.setAttribute("aria-label", `Destacar ${livro.titulo}`);
        botao.append(criarCapa(livro));
        botao.addEventListener("click", () => { selecionarDestaque(i); });
        botao.addEventListener("pointerenter", evento => { if (evento.pointerType === "mouse") selecionarDestaque(i); });
        return botao;
    }));
    $("destaque-livros").hidden = lista.length === 0;
    selecionarDestaque(destaque);
}

function atualizar() { preencherFiltros(); renderizarCatalogo(); renderizarDestaques(); }

function filtrar() { pagina = 1; renderizarCatalogo(); }

function fecharFiltros() { $("filtros-opcoes").classList.remove("aberto"); $("abrir-filtros").setAttribute("aria-expanded", "false"); }

function limparBusca() { $("form-busca").reset(); filtrar(); $("busca").focus({ preventScroll: true }); }

$("form-busca").addEventListener("submit", evento => {
    evento.preventDefault();
    filtrar();
    fecharFiltros();
});
$("busca").addEventListener("input", filtrar);
["categoria", "editora"].forEach(id => $(id).addEventListener("change", () => {
    if (!mobile.matches) filtrar();
}));
["limpar-busca", "recomecar-busca"].forEach(id => $(id).addEventListener("click", limparBusca));
$("abrir-filtros").addEventListener("click", () => {
    const aberto = $("filtros-opcoes").classList.toggle("aberto");
    $("abrir-filtros").setAttribute("aria-expanded", String(aberto));
    if (aberto) $("categoria").focus();
});
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && $("filtros-opcoes").classList.contains("aberto")) {
        fecharFiltros();
        $("abrir-filtros").focus();
    }
});
mobile.addEventListener("change", () => {
    pagina = 1;
    fecharFiltros();
    renderizarCatalogo();
});

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

atualizar();
