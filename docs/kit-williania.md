# Kit WillianIA no motor do pato

O kit em `../kit-video-3d WillianIA/` foi inspecionado em 15/11/2026. O pato e o formato `episodes/*/script.json` continuam sendo o centro da produção. O catálogo de cenário foi copiado para `engine/src/vendor/willian3d/` e pode ser usado em qualquer cena pelo `SceneObjectBuilder`.

## Mapa dos módulos

| Arquivos do kit | Função | Uso aqui |
|---|---|---|
| `assets/scenery/kit.js`, `index.js` | Registro, fábrica, parâmetros, progresso e atualização temporal dos objetos | Importados; `type: "kit"` expõe os objetos ao roteiro do pato |
| `assets/scenery/houses.js`, `buildings.js` | Casas, prédios, loja, galpão e ponte | Importados, mais úteis para fundos de episódios externos |
| `assets/scenery/trees.js`, `roads.js` | Vegetação, chão e vias | Importados; escolher conforme o cenário |
| `assets/scenery/vehicles.js`, `construction.js` | Veículos, obras e máquinas animadas | Importados; requerem escala e enquadramento próprios |
| `assets/scenery/props.js`, `generico.js` | Objetos, formas, tubos, hélice, engrenagem, esteira, tanque e processos | Importados; primeira opção para novos objetos explicativos |
| `assets/characters/*`, exceto `helpers.js` | Bonecos humanos, esqueleto e poses | Não conectados; o pato mantém a identidade e o rig próprios |
| `assets/animations/*` | 20 clips do esqueleto humano | Referência para recriar movimentos no rig do pato; não são compatíveis diretamente |
| `engine/player.*`, `fluxos.js`, `legendas.js` | Player e formato de storyboard próprios | Não importados; substituí-los quebraria o formato de episódio existente |
| `tools/render.mjs` | Render de trecho, prévia e quadros | Ideias aplicadas ao render Python existente |
| `tools/voz/*` | Kokoro, ElevenLabs, alinhamento e normalização | Referência para melhorar a narração; TTS atual preservado |
| `tools/validar.mjs`, `check.mjs`, `build-catalog.mjs` | Validação e catálogo do formato do kit | Referência para um validador do nosso schema, ainda não portados |
| `preview/*`, `catalog/*`, `templates/*`, `projects/*` | Navegador, documentação e exemplos | Material de consulta, sem dependência em produção |
| `docs/*`, `AGENTE.md` | Guia de roteiro, voz, processos e publicação | Referência editorial; adaptar à conversa direta do pato |

O kit não traz arquivo de licença. Antes de redistribuir ou publicar o código copiado, confirme os termos com o autor. A cópia local registra a origem sem alterar o material de referência.

## Usar um objeto

Dentro de `objects` de uma cena:

```json
{
  "id": "helice_demo",
  "type": "kit",
  "asset": "helice",
  "pos": [0.4, 0, 0],
  "scale": [0.6, 0.6, 0.6],
  "params": { "velocidade": 90 }
}
```

`asset` é um ID de `catalog/RESUMO.md` do kit. `params` usa os parâmetros daquele catálogo. Objetos com animação própria são atualizados pelo tempo do vídeo; os que têm etapas aceitam `progress` entre 0 e 1. A origem de cada asset fica no chão (`y = 0`), e a frente aponta para `+Z`. Ajuste tamanho e posição para os enquadramentos verticais do pato. `id` permite usar o objeto como âncora de etiquetas.

## Iteração rápida

O navegador desenha e captura cada frame; o número de threads do FFmpeg ajuda só na codificação. `--preview` reduz a captura para 540×960 e 15 fps. `--scene` escolhe uma cena por índice começando em 1; `--from` e `--to` escolhem segundos; `--stills` gera começo, meio e fim sem codificar vídeo. O vídeo bruto completo mantém `video_raw.mp4`; prévias e trechos têm nomes próprios e não o substituem.

```bash
make stills EP=ep01_ventilador SCENE=3
make preview EP=ep01_ventilador SCENE=3
pipeline/.venv/bin/python pipeline/2_render_frames.py episodes/ep01_ventilador --preview --from 8 --to 13
```

Há dois episódios `ep01_*`. Use o nome completo nos comandos `make` para evitar escolher o episódio errado. A montagem `3_assemble_video.py` usa apenas `video_raw.mp4`, gerado pelo render completo.

## Narração: diagnóstico inicial

`pipeline/1_generate_audio.py` usa Kokoro local, mistura `pm_alex` (75%) e `pm_santa` (25%), acelera o gancho a 1,22 e insere 0,32 s em cada `||`. Esses valores podem explicar a sensação de fala apressada e pausas mecânicas. Para um teste de voz, varie **um fator por vez** em uma cena curta: `tts_speed` (comece em 1,00–1,08), posição dos `||` e `pause` após a cena. Ouça o áudio antes de refazer o render. Uma mistura de vozes altera timbre, mas não cria intenção ou prosódia por si só. O roteiro deve ter frases faláveis e reação do pato no mesmo ponto do áudio.

Cada cena agora salva uma chave de cache junto ao WAV. Ao executar `make audio` novamente, falas idênticas reutilizam o áudio; alterações no texto, velocidade, pausa, vozes, modelo ou código de síntese invalidam só o que for necessário. A montagem da narração completa e o `timeline.json` continuam sendo atualizados.
