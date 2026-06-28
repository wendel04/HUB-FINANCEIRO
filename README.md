# Hub Operação

Dashboard financeiro para acompanhar receita, gastos, lucro, ROI, caixa, saque e investimento em tráfego.

## Rodar localmente

Abra `abrir-hub.bat` ou rode:

```bash
npm start
```

Depois acesse:

```text
http://127.0.0.1:8765/
```

## Dados

Os lançamentos ficam salvos no navegador via `localStorage`. Atualizar os arquivos do projeto não apaga os dados já lançados.

Antes de trocar de navegador, computador ou publicar uma nova versão, use o botão `Backup` dentro do hub. Para recuperar, use `Restaurar`.

## Vercel

Este projeto é estático e pode ser importado diretamente pela Vercel a partir do GitHub.
