# D4Sign Download

A ferramenta fará o download de todos os cofres a que você tiver acesso no D4Sign.

Conheça mais sobre o D4Sign em [d4sign.com.br](https://d4sign.com.br).

Por conta do rate limiting da API, o processo é executado novamente a cada 15 minutos
enquanto houver ao menos uma requisição bloqueada por rate limiting.

O software verifica se o arquivo já foi baixado antes de tentar novamente, sendo seguro
executar várias vezes para baixar mais documentos.

## Como usar

```
npm install
TOKEN_API=[seu_token_api] CRYPT_KEY=[seu_crypt_key] npm start
```

Em vez de usar o TOKEN_API e CRYPT_KEY por linha de comando, você pode usar arquivos `.env`.
Em caso de dúvidas, veja mais sobre o pacote [dotenv](https://www.npmjs.com/package/dotenv).

## Limitações

O sofware não segue a paginação da lista de documentos, então não baixará mais de 500 documentos.

## Aviso

Este software foi desenvolvido para fins educacionais, não podendo o autor ser responsabilizado
pelas consequências de seu uso. O usuário é o único responsável, devendo ele conhecer
os termos de uso da D4Sign e assumir a responsabilidade por utilizar a API D4Sign.
