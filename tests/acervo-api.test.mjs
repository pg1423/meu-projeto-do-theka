import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
    listarLivrosNaApi, listarNovidadesNaApi, listarOpcoesDoAcervoNaApi,
    buscarLivroNaApi, salvarLivroNaApi, excluirLivroNaApi
} from '../src/scripts/api.js';

// Respostas simuladas: os testes não modificam os livros da API real.
const livro = { id: 28, titulo: 'Livro de teste', autor: 'Autor', genero: 'Fantasia', editora: 'Suma' };
const campos = { titulo: 'Livro de teste', autor: 'Autor', isbn: '9780000000001', resumo: 'Resumo', editora: 8, genero: 2, numero_paginas: 100, ano_publicacao: 2026 };
const sessaoOriginal = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
function sessao(token) {
    const dados = new Map([['theka:auth:access', token]]);
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
        getItem: chave => dados.get(chave) ?? null, removeItem: chave => dados.delete(chave)
    } });
    return dados;
}
afterEach(() => {
    mock.restoreAll();
    if (sessaoOriginal) Object.defineProperty(globalThis, 'sessionStorage', sessaoOriginal);
    else delete globalThis.sessionStorage;
});

test('consulta envia busca, filtros e paginação ao servidor sem usar uma sessão vencida', async () => {
    sessao('sessao-vencida-ficticia');
    mock.method(globalThis, 'fetch', async (url, opcoes) => {
        const pedido = new URL(url);
        assert.equal(pedido.origin, 'https://thekapitrainee.pythonanywhere.com');
        assert.equal(pedido.pathname, '/livros/');
        assert.deepEqual(Object.fromEntries(pedido.searchParams), { page: '2', page_size: '8', search: 'ficção & aventura', genero: '2', editora: '8' });
        assert.equal(opcoes.headers.Authorization, undefined);
        assert.equal(opcoes.credentials, 'omit');
        return Response.json({ count: 9, results: [livro], next: null });
    });
    assert.deepEqual(await listarLivrosNaApi({ busca: ' ficção & aventura ', genero: 2, editora: 8, pagina: 2, porPagina: 8 }), { livros: [livro], total: 9 });
});

test('novidades, gêneros e editoras usam as listas retornadas pela API', async () => {
    mock.method(globalThis, 'fetch', async url => {
        if (url.endsWith('/novidades/')) return Response.json([livro]);
        if (url.endsWith('/generos/')) return Response.json([{ id: 2, nome: 'Fantasia' }]);
        if (url.endsWith('/editoras/')) return Response.json([{ id: 8, nome: 'Suma' }]);
        throw new Error('Endpoint inesperado');
    });
    assert.deepEqual(await listarNovidadesNaApi(), [livro]);
    assert.deepEqual(await listarOpcoesDoAcervoNaApi(), { generos: [{ id: 2, nome: 'Fantasia' }], editoras: [{ id: 8, nome: 'Suma' }] });
});

test('detalhes conferem o ID e recusam endereços no lugar do identificador', async () => {
    const chamada = mock.method(globalThis, 'fetch', async url => {
        assert.equal(url, 'https://thekapitrainee.pythonanywhere.com/livros/28/');
        return Response.json(livro);
    });
    assert.deepEqual(await buscarLivroNaApi(28), livro);
    await assert.rejects(buscarLivroNaApi('../users/'), /Material inválido/);
    assert.equal(chamada.mock.callCount(), 1);
});

test('cadastro envia campos e arquivo com multipart, incluindo a sessão disponível', async () => {
    sessao('acesso-ficticio');
    const capa = new File(['imagem de teste'], 'capa.png', { type: 'image/png' });
    mock.method(globalThis, 'fetch', async (url, opcoes) => {
        assert.equal(url, 'https://thekapitrainee.pythonanywhere.com/livros/');
        assert.equal(opcoes.method, 'POST');
        assert.equal(opcoes.headers.Authorization, 'Bearer acesso-ficticio');
        assert.equal(opcoes.headers['Content-Type'], undefined);
        assert.ok(opcoes.body instanceof FormData);
        for (const [campo, valor] of Object.entries(campos)) assert.equal(opcoes.body.get(campo), String(valor));
        assert.equal(opcoes.body.get('capa').name, 'capa.png');
        assert.equal(await opcoes.body.get('capa').text(), 'imagem de teste');
        assert.equal(opcoes.body.has('id'), false);
        return Response.json(livro, { status: 201 });
    });
    assert.deepEqual(await salvarLivroNaApi(campos, capa), livro);
});

test('edição usa PATCH e preserva a capa existente quando não há novo arquivo', async () => {
    mock.method(globalThis, 'fetch', async (url, opcoes) => {
        assert.equal(url, 'https://thekapitrainee.pythonanywhere.com/livros/28/');
        assert.equal(opcoes.method, 'PATCH');
        assert.equal(opcoes.body.has('capa'), false);
        assert.equal(opcoes.body.has('editora_nome'), false);
        assert.equal(opcoes.body.get('numero_paginas'), '');
        return Response.json(livro);
    });
    await salvarLivroNaApi({ ...campos, numero_paginas: null, editora_nome: 'Não enviar' }, null, 28);
});

test('exclusão aceita 204 sem tentar ler um corpo JSON', async () => {
    mock.method(globalThis, 'fetch', async (url, opcoes) => {
        assert.equal(url, 'https://thekapitrainee.pythonanywhere.com/livros/28/');
        assert.equal(opcoes.method, 'DELETE');
        return new Response(null, { status: 204 });
    });
    await excluirLivroNaApi(28);
});

test('erros de validação apresentam o campo devolvido pelo servidor', async () => {
    mock.method(globalThis, 'fetch', async () => Response.json({ isbn: ['Este ISBN já existe.'], capa: ['Envie uma imagem válida.'] }, { status: 400 }));
    await assert.rejects(salvarLivroNaApi(campos), /ISBN: Este ISBN já existe.*Capa: Envie uma imagem válida/);
});

test('sessão expirada é descartada e uma alteração não é reenviada automaticamente', async () => {
    const dados = sessao('acesso-vencido');
    const chamada = mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }));
    await assert.rejects(salvarLivroNaApi(campos), { codigo: 'sessao_expirada' });
    assert.equal(dados.has('theka:auth:access'), false);
    assert.equal(chamada.mock.callCount(), 1);
});

test('permissão, livro removido e excesso de solicitações não viram mensagens de sucesso', async () => {
    for (const [status, padrao] of [[403, /permissão/], [404, /não está mais disponível/], [429, /Muitas solicitações/]]) {
        mock.method(globalThis, 'fetch', async () => new Response('', { status }));
        await assert.rejects(excluirLivroNaApi(28), padrao);
        mock.restoreAll();
    }
});

test('resposta inválida ou falha de rede após alteração exige conferir o acervo', async () => {
    const respostas = [
        () => Response.json({}, { status: 201 }),
        () => new Response('<html>Erro</html>'),
        () => new Response('', { status: 503 }),
        () => { throw new TypeError('Conexão interrompida'); }
    ];
    for (const resposta of respostas) {
        const chamada = mock.method(globalThis, 'fetch', async () => resposta());
        await assert.rejects(salvarLivroNaApi(campos), { codigo: 'resultado_incerto' });
        assert.equal(chamada.mock.callCount(), 1);
        mock.restoreAll();
    }
    mock.method(globalThis, 'fetch', async () => Response.json({ ok: true }));
    await assert.rejects(excluirLivroNaApi(28), { codigo: 'resultado_incerto' });
});

test('resposta incompleta não é exibida como catálogo vazio', async () => {
    for (const dados of [{}, { count: 1, results: null }, { count: 2, results: [{ titulo: 'Sem ID' }] }]) {
        mock.method(globalThis, 'fetch', async () => Response.json(dados));
        await assert.rejects(listarLivrosNaApi(), /incompleta/);
        mock.restoreAll();
    }
    mock.method(globalThis, 'fetch', async () => Response.json({ count: 0, results: [] }));
    assert.deepEqual(await listarLivrosNaApi(), { livros: [], total: 0 });
});

test('uma consulta antiga pode ser cancelada sem gerar erro de conexão', async () => {
    const controle = new AbortController();
    mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')), { once: true });
    }));
    const consulta = listarLivrosNaApi({}, controle.signal);
    controle.abort();
    await assert.rejects(consulta, { name: 'AbortError' });
});

test('tempo limite na gravação cancela a chamada e mantém resultado incerto', async () => {
    mock.method(globalThis, 'setTimeout', (funcao, tempo) => { assert.equal(tempo, 15000); queueMicrotask(funcao); return 0; });
    mock.method(globalThis, 'clearTimeout', () => {});
    mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Tempo limite', 'AbortError')), { once: true });
    }));
    await assert.rejects(salvarLivroNaApi(campos), { codigo: 'resultado_incerto' });
});
