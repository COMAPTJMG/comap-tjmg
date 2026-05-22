# COMAP — Sistema Integrado TJMG

[![Deploy to GitHub Pages](https://github.com/actions/deploy-pages/workflows/deploy/badge.svg)](https://github.com/actions/deploy-pages)

Sistema PWA de gestão de manutenção predial para o Tribunal de Justiça de Minas Gerais.

## 🚀 Módulos

| Módulo | Descrição |
|--------|-----------|
| 🚨 **Emergencial** | Criação e gestão de ordens de serviço emergenciais (OSE) |
| 🔄 **Periódica** | Agendamento e controle de manutenções periódicas |
| 🔥 **PCI** | Controle de Prevenção e Combate a Incêndio por região |
| 📑 **Laudos** | Gestão de laudos, prontuários e diagramas |
| 📋 **Diário de Fiscalização** | Registro e acompanhamento de atividades de fiscalização |
| 📆 **Cronograma** | Calendário e cronograma de atividades |
| ⚠️ **Pendências** | Painel de pendências gerais, vencidos e atrasados |

## 📁 Estrutura

```
├── index.html          # App principal (PWA)
├── config.js           # Configurações e constantes
├── auth.js             # Autenticação
├── data.js             # Catálogos e dados
├── db.js               # Integração Supabase
├── sync.js             # Sincronização offline/online
├── state.js            # Gerenciamento de estado
├── router.js           # Roteamento de telas
├── utils.js            # Utilitários
├── photo-store.js      # Armazenamento de fotos
├── report-html.js      # Geração de relatórios HTML
├── report-pdf.js       # Geração de PDFs
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
├── gas/                # Google Apps Script (backend planilha)
│   ├── Config.gs
│   ├── Auth.gs
│   ├── Emr_server.gs   # Emergencial - servidor
│   ├── Per_server.gs   # Periódica - servidor
│   ├── Pci_server.gs   # PCI - servidor
│   ├── Lau_server.gs   # Laudos - servidor
│   └── ...
└── supabase/
    └── schema.sql      # Schema do banco de dados PRO
```

## 🔧 Regiões Gerenciadas

- **Norte** — CT 017/2026
- **Central** — CT 025/2026
- **Leste** — CT 019/2026
- **Zona da Mata** — CT 018/2026
- **Triângulo** — CT 392/2022
- **Sul** — CT 138/2023
- **Sudoeste** — CT 421/2022

## ⚙️ Configuração

### 1. Supabase
Execute o schema em `supabase/schema.sql` no SQL Editor do Supabase.

### 2. GitHub Pages
O deploy é automático via GitHub Actions ao fazer push na branch `main`.

Acesse: `Settings > Pages > Source: GitHub Actions`

### 3. Google Apps Script
Os arquivos em `gas/` são o backend da planilha COMAP.

## 📋 Formulário Emergencial — Colunas Principais

| Campo | Descrição |
|-------|-----------|
| ID | Identificador único |
| Data Abertura | Data/hora da OSE |
| Região | Norte / Central / Leste / etc. |
| Comarca | Comarca TJMG |
| Edificação | Unidade predial |
| Tipo | Tipo de serviço |
| Status | Pendente / Em Execução / Concluído / Cancelado |
| Data Conclusão | Data de encerramento |
| Responsável | Técnico responsável |

## 🔐 Segurança

- Autenticação por sessão com TTL de 12h
- Controle de acesso por perfil (MASTER / ADMIN / COORD / Regional)
- Credenciais no frontend devem ser migradas para Supabase Auth em produção

---

**Versão:** v77 | **Contrato padrão:** 017/2026 | **Tribunal:** TJMG
