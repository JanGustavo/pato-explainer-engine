SHELL := /bin/bash
PYTHON := $(shell [ -f pipeline/.venv/bin/python ] && echo pipeline/.venv/bin/python || echo python3)
PIPELINE_DIR := pipeline
EPISODES_DIR := episodes

# Permite passar o número/nome como argumento extra (ex: make episodio 1)
ifeq (episodio,$(firstword $(MAKECMDGOALS)))
  EP_ARG := $(word 2,$(MAKECMDGOALS))
  $(eval $(EP_ARG):;@:)
endif

# Resolve o diretório do episódio pelo prefixo (ex: "1" ou "01" ou "ep01" -> episodes/ep01_ventilador)
define resolve_ep
$(if $(wildcard $(EPISODES_DIR)/$(1)/script.json),$(EPISODES_DIR)/$(1),$(shell \
	num=$$(echo "$(1)" | sed -E 's/^(ep|episodio)//I'); \
	padded=$$(printf "%02d" "$$((10#$$num))" 2>/dev/null || echo "$$num"); \
	matches=$$(ls -d $(EPISODES_DIR)/ep$${padded}_* 2>/dev/null); \
	[ "$$(printf '%s\n' "$$matches" | sed '/^$$/d' | wc -l)" -eq 1 ] && printf '%s' "$$matches" \
))
endef

.PHONY: help episodio audio render video preview stills

help:
	@echo "Uso:"
	@echo "  make ep01              -> Roda o pipeline completo do ep01"
	@echo "  make episodio 1        -> Alias para rodar o pipeline completo do ep01"
	@echo "  make audio EP=1        -> Roda apenas o 1_generate_audio.py"
	@echo "  make render EP=1       -> Roda apenas a etapa de renderização"
	@echo "  make video EP=1        -> Roda apenas a etapa de montagem do vídeo"
	@echo "  make preview EP=ep01_ventilador SCENE=3 -> Prévia rápida de uma cena"
	@echo "  make stills EP=ep01_ventilador SCENE=3  -> Três quadros da cena"
	@echo "  Use o nome completo quando houver mais de um ep01"

# Suporta: make ep01, make ep02, make ep10...
ep%:
	@$(MAKE) _run_pipeline TARGET_NUM=$*

# Suporta: make episodio 1, make episodio 02...
episodio:
	@if [ -z "$(EP_ARG)" ]; then \
		echo "Erro: informe o número do episódio. Ex: make episodio 1"; \
		exit 1; \
	fi
	@$(MAKE) _run_pipeline TARGET_NUM=$(EP_ARG)

# Pipeline completo encadeado
_run_pipeline:
	$(eval EP_DIR := $(call resolve_ep,$(TARGET_NUM)))
	@if [ -z "$(EP_DIR)" ] || [ ! -d "$(EP_DIR)" ]; then \
		echo "Erro: episódio não encontrado ou número ambíguo; use o nome completo (ex: ep01_ventilador)."; \
		exit 1; \
	fi
	@echo "=== Iniciando pipeline para: $(EP_DIR) ==="
	$(PYTHON) $(PIPELINE_DIR)/1_generate_audio.py "$(EP_DIR)"
	@if [ -f "$(PIPELINE_DIR)/2_render_frames.py" ]; then \
		$(PYTHON) $(PIPELINE_DIR)/2_render_frames.py "$(EP_DIR)"; \
	elif [ -f "$(PIPELINE_DIR)/2_render_video.py" ]; then \
		$(PYTHON) $(PIPELINE_DIR)/2_render_video.py "$(EP_DIR)"; \
	elif [ -f "$(PIPELINE_DIR)/2_render.js" ]; then \
		node $(PIPELINE_DIR)/2_render.js "$(EP_DIR)"; \
	fi
	@if [ -f "$(PIPELINE_DIR)/3_assemble_video.py" ]; then \
		$(PYTHON) $(PIPELINE_DIR)/3_assemble_video.py "$(EP_DIR)"; \
	elif [ -f "$(PIPELINE_DIR)/3_assemble.py" ]; then \
		$(PYTHON) $(PIPELINE_DIR)/3_assemble.py "$(EP_DIR)"; \
	fi
	@echo "=== Concluído: $(EP_DIR)/output ==="

# Atalho individual para testar só o áudio/TTS
audio:
	$(eval EP_DIR := $(call resolve_ep,$(EP)))
	@if [ -z "$(EP_DIR)" ] || [ ! -d "$(EP_DIR)" ]; then \
		echo "Erro: episódio não encontrado ou número ambíguo; use EP=ep01_ventilador."; \
		exit 1; \
	fi
	$(PYTHON) $(PIPELINE_DIR)/1_generate_audio.py "$(EP_DIR)"

# Atalho individual para rodar só o render
render:
	$(eval EP_DIR := $(call resolve_ep,$(EP)))
	@if [ -z "$(EP_DIR)" ] || [ ! -d "$(EP_DIR)" ]; then \
		echo "Erro: episódio não encontrado ou número ambíguo; use EP=ep01_ventilador."; \
		exit 1; \
	fi
	@if [ -f "$(PIPELINE_DIR)/2_render_frames.py" ]; then \
		$(PYTHON) $(PIPELINE_DIR)/2_render_frames.py "$(EP_DIR)"; \
	elif [ -f "$(PIPELINE_DIR)/2_render_video.py" ]; then \
		$(PYTHON) $(PIPELINE_DIR)/2_render_video.py "$(EP_DIR)"; \
	elif [ -f "$(PIPELINE_DIR)/2_render.js" ]; then \
		node $(PIPELINE_DIR)/2_render.js "$(EP_DIR)"; \
	fi

# Atalho individual para rodar só a montagem
video:
	$(eval EP_DIR := $(call resolve_ep,$(EP)))
	@if [ -z "$(EP_DIR)" ] || [ ! -d "$(EP_DIR)" ]; then \
		echo "Erro: episódio não encontrado ou número ambíguo; use EP=ep01_ventilador."; \
		exit 1; \
	fi
	@if [ -f "$(PIPELINE_DIR)/3_assemble_video.py" ]; then \
		$(PYTHON) $(PIPELINE_DIR)/3_assemble_video.py "$(EP_DIR)"; \
	elif [ -f "$(PIPELINE_DIR)/3_assemble.py" ]; then \
		$(PYTHON) $(PIPELINE_DIR)/3_assemble.py "$(EP_DIR)"; \
	fi

preview stills:
	$(eval EP_DIR := $(call resolve_ep,$(EP)))
	@if [ -z "$(EP_DIR)" ] || [ ! -d "$(EP_DIR)" ]; then \
		echo "Erro: episódio não encontrado ou número ambíguo; use EP=ep01_ventilador."; \
		exit 1; \
	fi
	$(PYTHON) $(PIPELINE_DIR)/2_render_frames.py "$(EP_DIR)" --preview $(if $(SCENE),--scene $(SCENE),) $(if $(FROM),--from $(FROM),) $(if $(TO),--to $(TO),) $(if $(filter stills,$@),--stills,)
