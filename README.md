# Theka

Acervo virtual desenvolvido com HTML, CSS e JavaScript puro.

## Executar localmente

Requer Node.js 20 ou superior, sem dependências adicionais.

```sh
npm run dev
npm run check
npm test
```

Abra `http://localhost:5173`. O comando `check` verifica a sintaxe e os arquivos
referenciados; `test` verifica a integração de senhas com respostas simuladas,
sem enviar e-mails nem alterar contas reais.

## Recuperação e redefinição de senha

1. Em `src/pages/recuperar-senha.html`, o formulário envia o e-mail para
   `POST /auth/password/reset/`. A confirmação aparece depois da resposta da API.
2. A API envia um link com os parâmetros `uid` e `token` para o e-mail cadastrado.
3. A rota `auth/password/reset/confirm/index.html` recebe esse link e encaminha
   os parâmetros para `src/pages/redefinir-senha.html`.
4. A nova senha e sua confirmação são enviadas a
   `POST /auth/password/reset/confirm/`. Depois da confirmação da API, a sessão
   local é descartada e o usuário volta ao login.

O endpoint de redefinição exige no mínimo 8 caracteres e senhas iguais. A regra
de maiúscula, minúscula, número e símbolo pertence ao endpoint de cadastro.
Links incompletos, inválidos ou expirados mostram uma orientação para solicitar
outro e-mail. As telas também tratam falhas de conexão, demora e excesso de
tentativas, sem afirmar que a operação foi concluída quando não há confirmação.

### Endereço do link enviado pela API

O servidor da API monta o link usando sua configuração `FRONTEND_URL` e o caminho
`/auth/password/reset/confirm/?uid=...&token=...`. Essa configuração precisa
apontar para a origem que estiver servindo este projeto, por exemplo
`http://localhost:5173` em um ambiente de desenvolvimento controlado.

Esse endereço é definido no servidor da API: o front-end não consegue alterá-lo
no pedido de recuperação. O envio e a entrega de e-mails também dependem do SMTP
configurado nesse servidor. A validação completa do e-mail real depende dessas
configurações externas; os testes locais usam respostas simuladas.

Fontes: [documentação da API](https://thekapitrainee.pythonanywhere.com/docs/) e
[implementação dos endpoints](https://github.com/CarlosG18/theka_API/blob/main/users/serializers.py).
