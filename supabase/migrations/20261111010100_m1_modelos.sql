-- M1 — Modelos de checklist iniciais.
-- validity_days = prazo de referência para considerar a certidão "recente"
-- (só onde há prática consolidada); nos demais, vale a validade impressa no documento.

with t as (
  insert into public.checklist_templates (code, name, deal_kind, description)
  values (
    'IMV-CV-v1',
    'Compra e venda de imóvel',
    'compra_venda_imovel',
    'Certidões do imóvel e dos vendedores (PF/PJ) para a escritura de compra e venda, e identificação dos compradores.'
  )
  returning id
)
insert into public.template_items
  (template_id, code, section, title, description, scope, applies_roles, validity_days, required, sort_order)
select t.id, v.code, v.section, v.title, v.description, v.scope::public.item_scope,
       v.roles::public.party_role[], v.validity_days, v.required, v.sort_order
from t, (values
  ('IMV-01', 'Imóvel', 'Certidão de inteiro teor da matrícula',
   'Certidão da matrícula com negativa de ônus reais e de ações reais e pessoais reipersecutórias, emitida pelo Registro de Imóveis competente.',
   'imovel', null, 30, true, 10),
  ('IMV-02', 'Imóvel', 'Certidão negativa de débitos de IPTU',
   'Certidão de situação fiscal imobiliária emitida pela prefeitura, com a inscrição do imóvel.',
   'imovel', null, null, true, 20),
  ('IMV-03', 'Imóvel', 'Título aquisitivo anterior',
   'Escritura, formal de partilha ou contrato pelo qual o vendedor adquiriu o imóvel.',
   'imovel', null, null, true, 30),
  ('IMV-04', 'Imóvel', 'Declaração de quitação condominial',
   'Declaração do síndico ou administradora de inexistência de débitos condominiais (se houver condomínio).',
   'imovel', null, null, false, 40),
  ('IMV-05', 'Imóvel', 'Habite-se / averbação da construção',
   'Comprovação de que a construção existente está averbada na matrícula.',
   'imovel', null, null, false, 50),
  ('IMV-06', 'Imóvel', 'Situação de foro / laudêmio',
   'Certidão da SPU ou do senhorio direto, quando o imóvel for foreiro ou terreno de marinha.',
   'imovel', null, null, false, 60),

  ('VPF-01', 'Vendedor pessoa física', 'Documento de identidade e CPF', null,
   'parte_pf', '{vendedor,conjuge}', null, true, 110),
  ('VPF-02', 'Vendedor pessoa física', 'Certidão de estado civil atualizada',
   'Certidão de nascimento ou casamento atualizada e pacto antenupcial registrado, se houver.',
   'parte_pf', '{vendedor,conjuge}', 90, true, 120),
  ('VPF-03', 'Vendedor pessoa física', 'CND conjunta federal (RFB/PGFN)',
   'Certidão de débitos relativos a tributos federais e à dívida ativa da União.',
   'parte_pf', '{vendedor,conjuge}', 180, true, 130),
  ('VPF-04', 'Vendedor pessoa física', 'Certidão negativa de débitos trabalhistas (CNDT)', 'Emitida pelo TST.',
   'parte_pf', '{vendedor,conjuge}', 180, true, 140),
  ('VPF-05', 'Vendedor pessoa física', 'Distribuidor da Justiça Estadual',
   'Ações cíveis, de família, execuções fiscais e interdições/tutelas na comarca do imóvel e do domicílio.',
   'parte_pf', '{vendedor,conjuge}', 30, true, 150),
  ('VPF-06', 'Vendedor pessoa física', 'Distribuidor da Justiça Federal', 'Ações cíveis e execuções fiscais.',
   'parte_pf', '{vendedor,conjuge}', 30, true, 160),
  ('VPF-07', 'Vendedor pessoa física', 'Distribuidor da Justiça do Trabalho', 'Ações trabalhistas (1º e 2º graus).',
   'parte_pf', '{vendedor,conjuge}', 30, true, 170),
  ('VPF-08', 'Vendedor pessoa física', 'Certidão de protestos (5 anos)',
   'Tabelionatos de protesto da comarca do imóvel e do domicílio.',
   'parte_pf', '{vendedor,conjuge}', 30, true, 180),

  ('VPJ-01', 'Vendedor pessoa jurídica', 'Atos constitutivos e certidão da Junta Comercial',
   'Contrato social/estatuto com a última alteração e certidão simplificada atualizada.',
   'parte_pj', '{vendedor}', 30, true, 210),
  ('VPJ-02', 'Vendedor pessoa jurídica', 'CND conjunta federal (RFB/PGFN)', null,
   'parte_pj', '{vendedor}', 180, true, 220),
  ('VPJ-03', 'Vendedor pessoa jurídica', 'Certidão negativa de débitos trabalhistas (CNDT)', null,
   'parte_pj', '{vendedor}', 180, true, 230),
  ('VPJ-04', 'Vendedor pessoa jurídica', 'Certificado de regularidade do FGTS (CRF)', 'Emitido pela Caixa.',
   'parte_pj', '{vendedor}', null, true, 240),
  ('VPJ-05', 'Vendedor pessoa jurídica', 'Distribuidor da Justiça Estadual',
   'Ações cíveis, execuções fiscais, falências e recuperações judiciais.',
   'parte_pj', '{vendedor}', 30, true, 250),
  ('VPJ-06', 'Vendedor pessoa jurídica', 'Distribuidor da Justiça Federal', null,
   'parte_pj', '{vendedor}', 30, true, 260),
  ('VPJ-07', 'Vendedor pessoa jurídica', 'Distribuidor da Justiça do Trabalho', null,
   'parte_pj', '{vendedor}', 30, true, 270),
  ('VPJ-08', 'Vendedor pessoa jurídica', 'Certidão de protestos (5 anos)', null,
   'parte_pj', '{vendedor}', 30, true, 280),

  ('CMP-01', 'Comprador', 'Documento de identificação',
   'PF: identidade e CPF. PJ: contrato social e cartão CNPJ.',
   'parte_pf', '{comprador}', null, true, 310),
  ('CMP-02', 'Comprador', 'Documento de identificação',
   'PF: identidade e CPF. PJ: contrato social e cartão CNPJ.',
   'parte_pj', '{comprador}', null, true, 320),
  ('PRC-01', 'Procurador', 'Procuração pública atualizada',
   'Certidão da procuração emitida há menos de 30 dias, com poderes específicos.',
   'parte_pf', '{procurador}', 30, true, 410)
) as v(code, section, title, description, scope, roles, validity_days, required, sort_order);

-- Cessão de cotas / trespasse — checklist TETTU (clínica veterinária, 27/08/2026)
with t as (
  insert into public.checklist_templates (code, name, deal_kind, description)
  values (
    'TETTU-COTAS-v1',
    'Cessão de cotas / trespasse (TETTU)',
    'cessao_cotas',
    'Checklist documental TETTU para aquisição de cotas e trespasse de estabelecimento (modelo clínica veterinária). Período auditado: últimos 3 anos fiscais.'
  )
  returning id
)
insert into public.template_items
  (template_id, code, section, title, description, scope, applies_roles, validity_days, required, sort_order)
select t.id, v.code, v.section, v.title, v.description, 'negocio'::public.item_scope, null, v.validity_days, true, v.sort_order
from t, (values
  ('SOC-01', 'Documentação societária e governança', 'Contrato social e alterações',
   'Contrato social constitutivo e todas as alterações registradas na Junta Comercial até a última consolidação vigente.', null, 10),
  ('SOC-02', 'Documentação societária e governança', 'Certidões da Junta Comercial',
   'Certidão simplificada e certidão de inteiro teor atualizadas (expedidas há menos de 30 dias).', 30, 20),
  ('SOC-03', 'Documentação societária e governança', 'Documentos pessoais dos sócios',
   'RG/CNH, CPF, comprovante de residência e certidão de casamento/união estável (com pacto antenupcial, se houver) de todos os sócios.', null, 30),
  ('SOC-04', 'Documentação societária e governança', 'Procurações e atas societárias',
   'Procurações públicas ou particulares vigentes outorgadas pela sociedade e atas de deliberação/nomeação de administradores.', null, 40),
  ('SOC-05', 'Documentação societária e governança', 'Acordos de quotistas e ajustes parassociais',
   'Acordos de sócios, opções de compra/venda, direitos de preferência ou avenças vinculantes sobre as quotas.', null, 50),

  ('REG-01', 'Regulatório, sanitário e ambiental', 'Registro no conselho profissional e ART',
   'Certificado de regularidade PJ no conselho (ex.: CRMV) e Anotação de Responsabilidade Técnica do responsável.', null, 110),
  ('REG-02', 'Regulatório, sanitário e ambiental', 'Licença sanitária municipal',
   'Licença sanitária expedida pela Vigilância Sanitária municipal, devidamente revalidada.', null, 120),
  ('REG-03', 'Regulatório, sanitário e ambiental', 'Alvará de localização e funcionamento',
   'Alvará da prefeitura contemplando todas as atividades desenvolvidas.', null, 130),
  ('REG-04', 'Regulatório, sanitário e ambiental', 'Regularidade do Corpo de Bombeiros',
   'Certificado de Aprovação, Laudo de Exigências ou Certificado de Registro Provisório vigente.', null, 140),
  ('REG-05', 'Regulatório, sanitário e ambiental', 'Medicamentos de controle especial',
   'Autorização/cadastro para guarda e manipulação de medicamentos controlados (Portaria 344/98 e MAPA), com livros de movimentação.', null, 150),
  ('REG-06', 'Regulatório, sanitário e ambiental', 'PGRSS e coleta de resíduos',
   'Plano de Gerenciamento de Resíduos de Serviços de Saúde e contrato ativo com empresa licenciada de coleta.', null, 160),
  ('REG-07', 'Regulatório, sanitário e ambiental', 'Radioproteção',
   'Laudo radiométrico ambiental, dosimetria individual dos operadores e laudos de calibração dos equipamentos.', null, 170),

  ('TRIB-01', 'Regularidade fiscal e tributária', 'CND conjunta federal (PJ e sócios)',
   'Certidão de débitos relativos a tributos federais e à dívida ativa da União (RFB/PGFN).', 180, 210),
  ('TRIB-02', 'Regularidade fiscal e tributária', 'CND estadual (PJ e sócios)',
   'Certidão negativa de débitos da Fazenda estadual e, se exigida, da dívida ativa (Procuradoria do Estado).', null, 220),
  ('TRIB-03', 'Regularidade fiscal e tributária', 'CND municipal',
   'Certidões mobiliária (ISS e taxas) e imobiliária (IPTU do estabelecimento).', null, 230),
  ('TRIB-04', 'Regularidade fiscal e tributária', 'Relatório de situação fiscal (e-CAC)',
   'Relatório complementar de situação fiscal emitido no e-CAC/RFB.', 30, 240),
  ('TRIB-05', 'Regularidade fiscal e tributária', 'Declarações fiscais (5 anos)',
   'PGDAS-D, DEFIS, ECF, ECD, DCTF e EFD-Reinf entregues nos últimos 5 anos.', null, 250),
  ('TRIB-06', 'Regularidade fiscal e tributária', 'Parcelamentos fiscais ativos',
   'Extratos com saldo devedor e guias de parcelamentos em curso (ou declaração de inexistência).', null, 260),

  ('TRAB-01', 'Trabalhista, previdenciário e prestadores', 'CRF do FGTS e CNDT',
   'Certificado de regularidade do FGTS (Caixa) e Certidão Negativa de Débitos Trabalhistas (TST).', 180, 310),
  ('TRAB-02', 'Trabalhista, previdenciário e prestadores', 'Quadro de empregados e folha',
   'Relação de empregados CLT, funções, salários, adicionais e folhas recentes.', null, 320),
  ('TRAB-03', 'Trabalhista, previdenciário e prestadores', 'Contratos de prestadores / PJ',
   'Contratos com profissionais parceiros/PJ, especialistas e plantonistas (risco de vínculo).', null, 330),
  ('TRAB-04', 'Trabalhista, previdenciário e prestadores', 'Laudos de saúde ocupacional',
   'PGR, PCMSO, LTCAT, fichas de entrega de EPI assinadas e ASOs da equipe.', null, 340),
  ('TRAB-05', 'Trabalhista, previdenciário e prestadores', 'Controle de ponto e férias',
   'Espelhos de ponto dos últimos 12 meses, acordos de compensação e mapa de férias.', null, 350),

  ('JUD-01', 'Certidões forenses e contencioso', 'Justiça Estadual (PJ e sócios)',
   'Distribuidores cíveis, execuções fiscais, falências e recuperações da comarca.', 30, 410),
  ('JUD-02', 'Certidões forenses e contencioso', 'Justiça Federal (PJ e sócios)',
   'Distribuição cível e execuções fiscais da subseção judiciária.', 30, 420),
  ('JUD-03', 'Certidões forenses e contencioso', 'Justiça do Trabalho (PJ e sócios)',
   'Distribuição trabalhista de 1º e 2º graus.', 30, 430),
  ('JUD-04', 'Certidões forenses e contencioso', 'Protestos de títulos (PJ e sócios)',
   'Tabelionatos de protesto da comarca e do domicílio dos sócios (5 anos).', 30, 440),
  ('JUD-05', 'Certidões forenses e contencioso', 'Relatório de processos ativos',
   'Relatório dos advogados com ações em curso e risco financeiro estimado.', null, 450),

  ('OPR-01', 'Imóvel, ativos e contratos', 'Contrato de locação da sede',
   'Contrato de locação comercial, aditivos, quitação de aluguéis, vigência, garantia e cláusula de cessão/trespasse.', null, 510),
  ('OPR-02', 'Imóvel, ativos e contratos', 'Inventário de equipamentos e NFs',
   'Relação de ativos, notas fiscais e eventuais contratos de leasing.', null, 520),
  ('OPR-03', 'Imóvel, ativos e contratos', 'Contratos de fornecedores e softwares',
   'Contratos com laboratórios, fornecedores de insumos e licença do software de gestão.', null, 530),
  ('OPR-04', 'Imóvel, ativos e contratos', 'Marca e propriedade intelectual',
   'Registro ou protocolo da marca no INPI e titularidade de domínio e redes sociais.', null, 540),

  ('FIN-01', 'Contábil, financeiro e bancário', 'Demonstrações contábeis (3 anos)',
   'Balanço patrimonial, DRE e balancete analítico recente assinados por contador (CRC).', null, 610),
  ('FIN-02', 'Contábil, financeiro e bancário', 'Extratos bancários e endividamento',
   'Extratos dos últimos 12 meses e mapa de endividamento.', null, 620),
  ('FIN-03', 'Contábil, financeiro e bancário', 'Contas a pagar e a receber',
   'Relatório analítico de obrigações e haveres a receber.', null, 630)
) as v(code, section, title, description, validity_days, sort_order);
