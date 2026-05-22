# TJMG Fiscal PWA + Supabase PRO

Este pacote já vem com:
- `index.html` já apontando para `https://ynlindnkuyueouzatcpt.supabase.co`
- `supabase_pro_schema.sql` com esquema PRO + seed dos catálogos extraídos do seu código
- `catalogos_extraidos.json` com materiais, comarcas, edificações, grupos, sistemas, atividades, tipos, status e usuários legados
- `manifest.json` e `sw.js` para manter o PWA

## 1) Antes de tudo
No Supabase **não exponha**:
- senha do banco
- service_role key

Pode ficar no frontend:
- Project URL
- Publishable key

## 2) Rodar o SQL
1. Abra o projeto no Supabase.
2. Vá em **SQL Editor**.
3. Cole o conteúdo de `supabase_pro_schema.sql`.
4. Execute.

Esse SQL cria:
- tabelas brutas de compatibilidade: `app_users`, `inspections`
- camada PRO normalizada: `inspection_index`, `inspection_items`, `inspection_materials`, etc.
- catálogos: regiões, polos, comarcas, edificações, grupos, sistemas, atividades, materiais, status, tipos
- buckets: `relatorios` e `inspecoes-fotos`
- gatilho que parseia `inspections.payload` e preenche a camada PRO

## 3) Subir no GitHub
1. Crie um repositório novo no GitHub.
2. Envie todos os arquivos deste pacote.
3. Commit inicial.

Exemplo:
```bash
git init
git add .
git commit -m "TJMG Fiscal PWA + Supabase PRO"
git branch -M main
git remote add origin SEU_REPOSITORIO_GITHUB
git push -u origin main
```

## 4) Publicar no GitHub Pages
O workflow `.github/workflows/deploy.yml` já publica o conteúdo da branch `main` no GitHub Pages.

Depois:
1. Entre no repositório.
2. Vá em **Settings > Pages**.
3. Confirme que o source está em **GitHub Actions**.
4. Aguarde o workflow terminar.

## 5) Ajustes finais no Supabase
No **Authentication > URL Configuration**, adicione:
- URL do GitHub Pages
- domínio customizado, se usar

No **Storage**, verifique se os buckets foram criados.

## 6) Como o app funciona com o banco
O app atual continua gravando no formato bruto compatível com o código:
- usuários em `app_users`
- inspeções em `inspections`

Ao mesmo tempo, o banco mantém projeções PRO:
- `inspection_index`
- `inspection_systems`
- `inspection_selected_activities`
- `inspection_items`
- `inspection_materials`

Assim você não quebra o app atual e já ganha estrutura analítica/auditoria.

## 7) Consultas úteis

### Últimas inspeções
```sql
select *
from public.inspection_index
order by updated_at desc
limit 50;
```

### Materiais usados por inspeção
```sql
select inspection_id, origem, item_key, codigo, descricao, unidade, quantidade
from public.inspection_materials
order by inspection_id, origem, item_key nulls first, codigo;
```

### Edificações por comarca
```sql
select r.sigla as regiao, p.nome as polo, c.nome as comarca, e.nome as edificacao, e.grupo
from public.edificacoes e
join public.regioes r on r.id = e.regiao_id
join public.comarcas c on c.id = e.comarca_id
left join public.polos p on p.id = e.polo_id
order by r.sigla, p.nome, c.nome, e.nome;
```

## 8) Observação importante
Esse pacote usa a **publishable key** no frontend e **não usa** a senha do Postgres no navegador.

A connection string:
`postgresql://postgres:[YOUR-PASSWORD]@db.ynlindnkuyueouzatcpt.supabase.co:5432/postgres`

serve para:
- ferramentas de administração
- migrações externas
- scripts backend

Ela **não** deve ir para `index.html`.

## 9) Próximo passo recomendado
Depois de validar esta versão:
- migrar login local para Supabase Auth
- endurecer as policies RLS
- criar Edge Functions para e-mail, logs e Google Drive