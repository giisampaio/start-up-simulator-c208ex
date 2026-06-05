# Caravan EX — Simulador de Partida

Simulador didático da partida do motor do Cessna 208B Grand Caravan EX
(PT6A-140 / G1000). Web app responsivo (Vite + TypeScript), pensado para celular,
instalável como PWA.

## Desenvolvimento

```bash
npm install
npm run dev            # http://localhost:5179
```

## Build

```bash
npm run build          # -> dist/         (hospedar / PWA)
npm run build:single   # -> dist-single/index.html  (UM arquivo p/ enviar offline)
npm run preview        # serve o build local
```

## Deploy no EasyPanel (VPS) — via Docker

O repositório já tem `Dockerfile` (build Vite + Nginx) e `nginx.conf`.

1. No EasyPanel: **Create → App**.
2. **Source:** GitHub → selecione o repo `start-up-simulator-c208ex`, branch `main`.
3. **Build:** método **Dockerfile** (o EasyPanel detecta o `Dockerfile` na raiz).
4. **Deploy:** o container expõe a **porta 80**. Em **Domains**, adicione seu
   domínio/subdomínio e ative **HTTPS** (Let's Encrypt) — o EasyPanel cuida do TLS.
5. **Salvar / Deploy.** A cada `git push` na `main`, redeploy (manual ou automático
   se você ativar o webhook do GitHub no EasyPanel).

> Com HTTPS ativo, o app vira **PWA instalável** ("Adicionar à tela inicial"),
> com ícone, tela cheia e funcionamento offline (service worker).

### Testar a imagem localmente (opcional)

```bash
docker build -t caravan-ex .
docker run --rm -p 8080:80 caravan-ex   # http://localhost:8080
```

## Estrutura

```
.
├─ index.html          layout responsivo (EIS fixo no topo no celular)
├─ src/
│  ├─ main.ts          estado + física + render + interação + registro do SW
│  └─ style.css        estilo mobile-first
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icon.svg
│  └─ sw.js            service worker (offline)
├─ Dockerfile          build + Nginx
├─ nginx.conf
└─ vite.config.ts      dois modos de build (dist / dist-single)
```

## Fidelidade

Modelo aproximado do POH 208BPHCUS-04 + Pilot Training Manual (FSI). Os "gates"
da partida são fiéis; a física entre eles é estimada.
**Não substitui o POH/AFM nem simulador certificado.**

> Nota iOS: o ícone de tela inicial usa SVG; para o ícone aparecer no iPhone
> pode ser necessário adicionar um `apple-touch-icon` em PNG (180×180) depois.
