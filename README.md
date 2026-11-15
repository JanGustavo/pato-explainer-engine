# Pato Explainer Engine

Vídeos verticais explicativos em Three.js com o pato como apresentador. Cada episódio fica em `episodes/<nome>/script.json`. A pipeline gera a narração e a linha do tempo, renderiza o vídeo bruto e depois junta o áudio.

## Fluxo

```bash
make audio EP=ep01_ventilador
make stills EP=ep01_ventilador SCENE=3
make preview EP=ep01_ventilador SCENE=3
make render EP=ep01_ventilador
make video EP=ep01_ventilador
```

`make render` produz `output/video_raw.mp4`; `make video` produz o vídeo final com áudio. As prévias produzem arquivos separados, preservando o render completo. Use o nome completo do episódio, pois há dois diretórios `ep01_*`.

O catálogo do kit 3D, o formato `type: "kit"`, o mapa dos arquivos e as opções de render por trecho estão em [docs/kit-williania.md](docs/kit-williania.md). O pato permanece no motor principal; os personagens humanos do kit não o substituem.
