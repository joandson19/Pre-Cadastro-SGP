# Cadastro de Cliente — versão para hospedagem comum (PHP)

Tudo que está nesta pasta vai para a pasta pública do seu site (ex.: `public_html`). Não precisa de Node, Composer nem nada fora dela.

## ⚠️ Antes de publicar: revogue os tokens antigos

Os tokens do antigo `config.js` ficaram legíveis por qualquer visitante.
1. **SGP**: gere um novo token e desative o antigo.
2. **Telegram**: no @BotFather use `/revoke` e guarde o novo token.
3. **Apague o `config.js` e o `submitForm.js` antigos** do servidor. Se já estiveram no Git, os tokens ficam no histórico: o que protege é revogá-los.

## Instalação

1. Edite `api/config.php` e coloque o **novo** token do SGP (e, se quiser, o do Telegram e o chat id).
2. Envie **todo o conteúdo** da pasta `site/` para a pasta pública, mantendo a pasta `api/`.
   Atenção: os arquivos `.htaccess` (na raiz e em `api/`) começam com ponto e às vezes ficam ocultos no gerenciador de arquivos. Confirme que foram enviados.
3. Requisitos: PHP 7.4+ com a extensão cURL (padrão na grande maioria das hospedagens).

## Como os segredos ficam protegidos

O navegador só fala com `api/opcoes.php` e `api/cadastro.php`. Esses arquivos são PHP: o servidor os **executa**, então ninguém vê o código nem os tokens, que ficam em `api/config.php`.

Proteções em camadas para o `config.php`:
- é PHP e não imprime nada se aberto direto (devolve 403);
- `api/.htaccess` bloqueia o acesso direto em Apache/LiteSpeed.

**Faça este teste depois de publicar:**
abra `https://seusite/api/config.php` e `https://seusite/api/_bootstrap.php`. O resultado deve ser página em branco ou "403/Forbidden". Se aparecer código, o PHP não está sendo executado nessa pasta: apague os arquivos e fale com o suporte da hospedagem.

**Regra de ouro:** nunca deixe cópias como `config.php.bak`, `config.php~`, `config - cópia.php` ou `config.txt` no servidor; elas são entregues como texto puro.

## O que o backend faz

- Lista planos, vencimentos e vendedores do SGP (cache de 5 min, só campos necessários).
- Valida tudo no servidor (CPF/CNPJ, e-mail, data, CEP, UF, coordenadas, plano/vencimento/vendedor existentes) e repassa ao SGP somente campos conhecidos.
- Envia o cadastro ao SGP e, **só se for aceito**, avisa no Telegram (CPF/CNPJ mascarado).
- Limite por IP (10 cadastros a cada 15 min; 60 consultas/min), corpo máximo de 10 KB, bloqueio de POST vindo de outros sites, campo-armadilha contra robôs.
- Erros PHP nunca aparecem ao visitante; mensagens genéricas na tela, detalhes no log do servidor.
- Cabeçalhos de segurança (CSP etc.) via `.htaccess`.

## Ajustes pequenos além da segurança
CPF com dígitos todos iguais agora é rejeitado; corrigidos `lang`, `label` do CEP e `maxlength` duplicado; mapa em largura total.

## Dúvidas comuns
- **Mapa não aparece:** a CSP do `.htaccess` pode estar restritiva demais para o seu servidor; em último caso remova a linha `Content-Security-Policy`.
- **Cloudflare na frente:** em `config.php` use `'ip_header' => 'HTTP_CF_CONNECTING_IP'`.
- **Servidor Nginx (sem .htaccess):** a proteção do `config.php` continua valendo pelo código; os cabeçalhos de segurança precisariam ser configurados no próprio Nginx.
