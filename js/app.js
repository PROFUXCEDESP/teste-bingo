document.addEventListener("DOMContentLoaded", () => {
    
    // Função de tratamento inteligente para acentuação, espaços e maiúsculas
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dliu0ck6y/image/upload'; 
    const CLOUDINARY_PRESET = 'bingo_2026';
    
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    
    window.fotoFileGlobal = null; let cropperInstancia = null;
    window.alunoEmFocoIdx = null; window.modoEdicaoFoto = false; window.tipoPessoaEmFoco = 'Educando';
    
    window.lotesValidadosNestaSessao = new Set(); 

    window.pages = {
        rankAdm: { current: 1, term: "" },
        gestaoLotes: { current: 1, term: "" },
        logs: { current: 1 },
        caixa: { current: 1 },
        rankProfAdm: { current: 1 },
        minhaTurma: { current: 1, term: "", turma: "Todas" },
        rankEdu: { current: 1, term: "" },
        rankProfEdu: { current: 1 }
    };

    window.caixaGlobalBD = []; window.todosEducandosBD = []; window.todosParceirosBD = []; 
    window.mockEducadoresBD = []; window.lotesSedeBD = []; window.logsDoSistema = [];

    window.renderPaginationUI = function(containerId, key, totalItems, itemsPerPage, renderFunc) {
        const container = document.getElementById(containerId);
        if(!container) return;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if(window.pages[key].current > totalPages) window.pages[key].current = totalPages;
        if(window.pages[key].current < 1) window.pages[key].current = 1;

        container.innerHTML = `<div class="discrete-pagination"><button class="btn-page-discrete" ${window.pages[key].current === 1 ? 'disabled' : ''} onclick="window.goPage('${key}', -1, '${renderFunc}')">&lt;</button><input type="number" class="page-input-discrete" value="${window.pages[key].current}" min="1" max="${totalPages}" onchange="window.jumpPage('${key}', this, '${renderFunc}')"><span style="color:var(--dim-grey); font-size:0.9rem;">de ${totalPages}</span><button class="btn-page-discrete" ${window.pages[key].current === totalPages ? 'disabled' : ''} onclick="window.goPage('${key}', 1, '${renderFunc}')">&gt;</button></div>`;
    }

    window.goPage = (key, dir, func) => { window.pages[key].current += dir; if(window[func]) window[func](); };
    window.jumpPage = (key, input, func) => { let val = parseInt(input.value) || 1; window.pages[key].current = val; if(window[func]) window[func](); };

    window.registrarLog = function(acao, detalhe) {
        const dataHora = new Date().toLocaleString('pt-BR');
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'registrar_log', dataHora, responsavel: userName, sessao: 'Web', acao, detalhe, localizacao: 'Sistema Web' }) });
    }

    window.addEventListener('click', () => { document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open')); });

    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.custom-select-trigger');
        if (trigger) {
            e.stopPropagation();
            const select = trigger.closest('.custom-select');
            document.querySelectorAll('.custom-select').forEach(s => { if(s !== select) s.classList.remove('open'); });
            select.classList.toggle('open');
        }
        const option = e.target.closest('.custom-option');
        if (option) {
            const select = option.closest('.custom-select-wrapper');
            const val = option.getAttribute('data-value');
            const text = option.innerText;
            select.querySelector('.trigger-text').innerText = text;
            select.querySelector('input[type="hidden"]').value = val;
        }
    });

    window.mudarAbaEducador = function(secId, navId) {
        document.querySelectorAll('main.admin-container > section').forEach(sec => sec.style.display = 'none');
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));
        const secClicada = document.getElementById(secId); if(secClicada) secClicada.style.display = 'block';
        const navClicado = document.getElementById(navId); if(navClicado) navClicado.classList.add('active');
        if(window.innerWidth <= 768) { const side = document.getElementById('sidebar'); if(side) side.classList.remove('open'); }
        if(document.getElementById("educadorPage") && window.atualizarDashboardEducador) window.atualizarDashboardEducador();
        if(document.getElementById("adminPage") && window.atualizarDashboardsADM) window.atualizarDashboardsADM();
    }

    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    if(openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
    if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

    window.carregarDadosDoBanco = function(recarregarTelas = true) {
        const btnSync = document.getElementById('nomeEducador');
        if(btnSync) btnSync.innerText = "Sincronizando...";

        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                window.lotesSedeBD = data.lotesSede.map(l => ({ codigo: l['Codigo_Lote'] || l['ID do Lote'], educador: l['Responsavel_Atual'] || l['Educador_Destino'] || '' })).filter(l => l.codigo);

                window.todosEducandosBD = data.educandos.map(e => ({
                    nome: e['Nome_Educando'] || e['Nome'], curso: e['Curso'], turma: e['Turma'], 
                    educadorResponsavel: e['Educador_Responsavel'] || '', cadastroAtivo: e['Cadastro_Ativo'] || '',
                    foto: e['Foto_URL'] && String(e['Foto_URL']).trim() !== '' ? e['Foto_URL'] : `https://ui-avatars.com/api/?name=${e['Nome_Educando'] || e['Nome']}&background=BC68A1&color=fff`,
                    lotesPendentes: e['Lotes_Pendentes'] ? String(e['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: e['Lotes_Vendidos'] ? String(e['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: e['Lotes_Devolvidos'] ? String(e['Lotes_Devolvidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    cartelasEntregues: parseInt(e['Cartelas_Entregue']) || 0
                }));

                window.todosParceirosBD = (data.parceiros || []).map(p => ({
                    nome: p['Nome'], cartela: p['Cartela_Retirada'], turma: 'Parceiro', curso: 'Comércio/Apoiador',
                    foto: `https://ui-avatars.com/api/?name=${p['Nome']}&background=4CAF50&color=fff`,
                    lotesPendentes: p['Lotes_Pendentes'] ? String(p['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: p['Lotes_Vendidos'] ? String(p['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: []
                }));

                window.mockEducadoresBD = data.educadores.map(e => {
                    let vendidos = 0; let pendentes = 0;
                    window.todosEducandosBD.forEach(al => {
                        if(textoIgual(al.educadorResponsavel, e['Nome'])) { vendidos += al.lotesVendidos.length; pendentes += al.lotesPendentes.length; }
                    });
                    let retiradosSede = window.lotesSedeBD.filter(l => textoIgual(l.educador, e['Nome'])).length;
                    return { nome: e['Nome'], curso: e['Curso Responsavel'], lotesRetiradosSede: retiradosSede, lotesVendidos: vendidos, lotesPendentes: pendentes };
                });

                window.caixaGlobalBD = data.caixaGlobal || []; 
                window.logsDoSistema = data.logs || [];

                if(btnSync) btnSync.innerText = userName;
                if (recarregarTelas) {
                    if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
                    if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
                }
            }
        }).catch(err => { console.error(err); if(btnSync) btnSync.innerText = "Erro de Conexão"; });
    }

    function calcularRecompensas(qtdVendidos) {
        let fone = qtdVendidos >= 10 ? 1 : 0;
        let cartelas = qtdVendidos >= 5 ? 1 + Math.floor((qtdVendidos - 5) / 5) : 0;
        return { fone, cartelas };
    }

    window.renderGestaoLotesPaginado = function() {
        const tabela = document.getElementById('tabelaGestaoLotes'); if(!tabela) return;
        
        let listaUnificada = [
            ...window.todosEducandosBD.map(e => ({ ...e, tipo: e.turma === 'Equipe' ? 'Equipe' : 'Educando', bdIdx: window.todosEducandosBD.indexOf(e) })),
            ...window.todosParceirosBD.map(p => ({ ...p, tipo: 'Parceiro', bdIdx: window.todosParceirosBD.indexOf(p) }))
        ];

        let filtrados = listaUnificada.filter(a => a.lotesPendentes.length > 0);
        if(window.pages.gestaoLotes.term) filtrados = filtrados.filter(a => a.nome.toLowerCase().includes(window.pages.gestaoLotes.term.toLowerCase()));

        const startIdx = (window.pages.gestaoLotes.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map((pessoa) => {
            let corBadge = pessoa.tipo === 'Parceiro' ? '#4CAF50' : (pessoa.tipo === 'Equipe' ? 'var(--sunflower-gold)' : 'var(--petal-pink)');
            return `<tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${pessoa.bdIdx}, '${pessoa.tipo}')">
                <td><img src="${pessoa.foto}" class="table-avatar" style="border-color:${corBadge}"></td>
                <td><strong>${pessoa.nome}</strong><br><small style="color:${corBadge}; font-weight:bold;">${pessoa.tipo}</small></td>
                <td style="color:var(--dim-grey);">${pessoa.curso || '-'}</td>
                <td class="td-center highlight-yellow" style="font-weight:bold; font-size:1.1rem;">${pessoa.lotesPendentes.length}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="4" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhum lote pendente para o critério digitado.</td></tr>`;
        
        window.renderPaginationUI('pagLotes', 'gestaoLotes', filtrados.length, 10, 'renderGestaoLotesPaginado');
    }

    const adminPage = document.getElementById("adminPage");
    if (adminPage) {
        
        window.atualizarDashboardsADM = function() {
            let vEdu = 0, vEquipe = 0, vParc = 0;
            let vPix = 0, vDin = 0;
            
            window.caixaGlobalBD.forEach(tx => {
                let val = parseFloat(tx['Valor']) || parseFloat(tx['Valor_Total']) || 0;
                let cat = tx['Categoria'] || 'Educando';
                let met = String(tx['Metodo'] || tx['Forma_Pagamento'] || '').toUpperCase();
                
                if(cat === 'Equipe') vEquipe += val;
                else if(cat === 'Parceiro') vParc += val;
                else vEdu += val;

                if(met.includes('PIX')) vPix += val;
                else if(met.includes('DINHEIRO') || met.includes('ESPECIE')) vDin += val;
            });

            const vTotal = vEdu + vEquipe + vParc;

            if(document.getElementById('kpiVendasEducandos')) document.getElementById('kpiVendasEducandos').innerText = `R$ ${vEdu.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiVendasEquipe')) document.getElementById('kpiVendasEquipe').innerText = `R$ ${vEquipe.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiVendasParceiros')) document.getElementById('kpiVendasParceiros').innerText = `R$ ${vParc.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiVendasReaisGlobal')) document.getElementById('kpiVendasReaisGlobal').innerText = `R$ ${vTotal.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaPix')) document.getElementById('kpiCaixaPix').innerText = `R$ ${vPix.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaDinheiro')) document.getElementById('kpiCaixaDinheiro').innerText = `R$ ${vDin.toFixed(2).replace('.', ',')}`;

            window.renderGestaoLotesPaginado();

            const tabelaRankingEducadoresADM = document.getElementById('tabelaRankingEducadoresADM');
            if(tabelaRankingEducadoresADM) {
                const nomesExcluidos = ['jhersyka', 'debora', 'bruna'];
                
                let rankingProf = [...window.mockEducadoresBD].filter(e => {
                    let nomeLimpo = e.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                    return !nomesExcluidos.includes(nomeLimpo);
                }).sort((a, b) => b.lotesVendidos - a.lotesVendidos);

                const startIdx = (window.pages.rankProfAdm.current - 1) * 10;
                const paginated = rankingProf.slice(startIdx, startIdx + 10);

                tabelaRankingEducadoresADM.innerHTML = paginated.map((prof, index) => {
                    return `<tr><td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${startIdx + index + 1}º</td><td><strong>${prof.nome}</strong></td><td style="color: var(--dim-grey);">${prof.curso}</td><td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${prof.lotesVendidos}</td></tr>`;
                }).join('');
                window.renderPaginationUI('pagRankingEducadores', 'rankProfAdm', rankingProf.length, 10, 'atualizarDashboardsADM');
            }

            const listaLotesParceiros = document.getElementById("listaLotesParceirosCheckboxes");
            if(listaLotesParceiros) {
                let htmlLotes = '';
                let lotesEmUso = [];
                window.todosParceirosBD.forEach(p => { lotesEmUso.push(...p.lotesPendentes); lotesEmUso.push(...p.lotesVendidos); });

                const lotesFiltrados = window.lotesSedeBD.filter(l => l.codigo.toUpperCase().includes('PARC'));
                
                lotesFiltrados.forEach(l => {
                    if(lotesEmUso.includes(l.codigo)) {
                        htmlLotes += `<label class="checkbox-item-row" style="opacity: 0.5;"><input type="checkbox" class="roxo-checkbox" disabled> <span style="text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size:0.8rem; color:#a0a0a0;">Em uso</span></label>`;
                    } else {
                        htmlLotes += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span>${l.codigo}</span></label>`;
                    }
                });
                listaLotesParceiros.innerHTML = htmlLotes || '<div style="padding:15px; text-align:center; color:#a0a0a0;">Nenhum lote contendo "PARC" vago na Sede.</div>';
            }

            const selectParceiroAttr = document.getElementById("opcoesParceiroAtribuir");
            if(selectParceiroAttr) {
                let opts = '';
                if(window.todosParceirosBD.length === 0) opts = '<span class="custom-option" data-value="">Nenhum parceiro cadastrado.</span>';
                else window.todosParceirosBD.forEach(p => { opts += `<span class="custom-option" data-value="${p.nome}">${p.nome}</span>`; });
                selectParceiroAttr.innerHTML = opts;
            }
        };

        const formCadastrarParceiro = document.getElementById("formCadastrarParceiro");
        if(formCadastrarParceiro) {
            formCadastrarParceiro.addEventListener("submit", (e) => {
                e.preventDefault();
                const btn = formCadastrarParceiro.querySelector("button[type='submit']");
                btn.innerText = "Salvando..."; btn.disabled = true;

                const nome = document.getElementById("nomeParceiroInput").value;
                const cartela = document.getElementById("cartelaParceiroInput").value; 

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'cadastrar_parceiro', nome, cartela })
                }).then(res => res.json()).then(data => {
                    btn.innerText = "Salvar Parceiro"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Cadastro Parceiro", `Cadastrou o parceiro ${nome} (Cartela: ${cartela})`);
                        fecharModal('modalCadastrarParceiro'); formCadastrarParceiro.reset();
                        window.abrirModalSucesso(data.message); window.carregarDadosDoBanco();
                    } else window.abrirModalErro(data.message);
                }).catch(() => { btn.disabled = false; btn.innerText = "Salvar Parceiro"; });
            });
        }

        const formAtribuirLoteParceiro = document.getElementById("formAtribuirLoteParceiro");
        if(formAtribuirLoteParceiro) {
            formAtribuirLoteParceiro.addEventListener("submit", (e) => {
                e.preventDefault();
                const nomeInput = document.getElementById("parceiroAtribuirSelect").value;
                const checkboxesMarcados = document.querySelectorAll('#listaLotesParceirosCheckboxes input[type="checkbox"]:checked');
                const lotesArray = Array.from(checkboxesMarcados).map(cb => cb.value);

                if(!nomeInput || lotesArray.length === 0) return window.abrirModalErro("Selecione o parceiro e marque ao menos um lote.");
                const btn = formAtribuirLoteParceiro.querySelector("button[type='submit']");
                btn.innerText = "Atribuindo..."; btn.disabled = true;

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atribuir_lote_parceiro', nome: nomeInput, lotes: lotesArray }) })
                .then(res => res.json()).then(data => {
                    btn.innerText = "Confirmar Atribuição"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Atribuição Parceiro", `Atribuiu lotes ${lotesArray.join(', ')} para o parceiro ${nomeInput}`);
                        fecharModal('modalAtribuirLoteParceiro'); formAtribuirLoteParceiro.reset(); 
                        window.abrirModalSucesso("Lotes PARC atribuídos com sucesso!"); window.carregarDadosDoBanco(); 
                    } else window.abrirModalErro(data.message);
                }).catch(err => { btn.disabled = false; btn.innerText = "Confirmar Atribuição"; });
            });
        }

        const buscaLotesInput = document.getElementById('buscaLotesInput');
        if(buscaLotesInput) {
            buscaLotesInput.addEventListener('input', (e) => {
                window.pages.gestaoLotes.term = e.target.value;
                window.pages.gestaoLotes.current = 1;
                window.renderGestaoLotesPaginado();
            });
        }
    }

    window.abrirModal = function(id) { document.getElementById(id).classList.add('active'); }
    window.fecharModal = function(id) { document.getElementById(id).classList.remove('active'); }
    window.abrirModalSucesso = function(txt) { document.getElementById('textoModalSucesso').innerText = txt; abrirModal('modalSucesso'); }
    window.abrirModalErro = function(txt) { const pErro = document.getElementById('textoModalErro'); if(pErro) pErro.innerText = txt; abrirModal('modalErro'); }
    window.toggleMisto = function(mostrar) { document.getElementById('camposMisto').style.display = mostrar ? 'flex' : 'none'; }

    window.abrirDetalhesAluno = function(idx, tipo = 'Educando') {
        window.alunoEmFocoIdx = idx; 
        window.tipoPessoaEmFoco = tipo;
        
        let pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx];
        
        const elFoto = document.getElementById('detalheFoto'); if(elFoto) elFoto.src = ...;
        if(elFoto) elFoto.src = pessoa.foto;
        const elNome = document.getElementById('detalheNome'); if(elNome) elNome.innerText = pessoa.nome;
        const elTurma = document.getElementById('detalheTurma'); if(elTurma) elTurma.innerText = `${pessoa.curso} - ${tipo}`;
        
        const recompensas = calcularRecompensas(pessoa.lotesVendidos.length);
        const elFone = document.getElementById('detalheFone'); if(elFone) elFone.innerText = recompensas.fone;
        const elCartelas = document.getElementById('detalheCartelasGanhas'); if(elCartelas) elCartelas.innerText = recompensas.cartelas;

        const elVendidos = document.getElementById('detalheQtdVendidos'); if(elVendidos) elVendidos.innerText = pessoa.lotesVendidos.length;
        const elPendentes = document.getElementById('detalheQtdPendentes'); if(elPendentes) elPendentes.innerText = pessoa.lotesPendentes.length;
        
        const badgeVendidos = pessoa.lotesVendidos.length ? pessoa.lotesVendidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        
        let badgePendentes = '<span class="badge-lote vazio">Nenhum</span>';
        if(pessoa.lotesPendentes.length) {
            badgePendentes = pessoa.lotesPendentes.map(l => `<span class="badge-lote" style="border: 1px dashed var(--sunflower-gold); cursor:pointer;" onclick="abrirAcaoLote('${l}', ${idx}, '${tipo}'); event.stopPropagation();">${l} ⚙️</span>`).join('');
        }
        
        const bV = document.getElementById('detalheBadgesVendidos'); if(bV) bV.innerHTML = badgeVendidos;
        const bP = document.getElementById('detalheBadgesPendentes'); if(bP) bP.innerHTML = badgePendentes;
        
        abrirModal('modalDetalhesAluno');
    }

    window.abrirAcaoLote = function(lote, idx, tipo) {
        if(window.lotesValidadosNestaSessao.has(lote)) return window.abrirModalErro("Este lote já foi processado.");
        
        let pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx];
        
        document.getElementById('acaoLoteNome').innerText = lote;
        document.getElementById('acaoLoteAluno').innerText = pessoa.nome;
        document.getElementById('acaoLoteInput').value = lote;
        document.getElementById('acaoAlunoIdxInput').value = idx;
        
        document.getElementById('modalAcaoLote').setAttribute('data-tipo', tipo);
        
        window.toggleMisto(false); 
        if(document.getElementById('valorPixMisto')) document.getElementById('valorPixMisto').value = ''; 
        if(document.getElementById('valorDinMisto')) document.getElementById('valorDinMisto').value = '';
        fecharModal('modalDetalhesAluno'); abrirModal('modalAcaoLote');
    }

    window.confirmarVendaLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const tipo = document.getElementById('modalAcaoLote').getAttribute('data-tipo');
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx];
        
        const formaPagamento = document.querySelector('input[name="formaPagamentoLote"]:checked').value;
        let vPix = 0, vDin = 0;

        if (formaPagamento === "PIX") { vPix = 20.00; } 
        else if (formaPagamento === "Dinheiro") { vDin = 20.00; } 
        else {
            vPix = parseFloat(document.getElementById('valorPixMisto').value) || 0;
            vDin = parseFloat(document.getElementById('valorDinMisto').value) || 0;
            if (vPix + vDin !== 20.00) return window.abrirModalErro(`A somatória de valores parciais precisa ser exatamente R$ 20,00.`);
        }

        if(window.lotesValidadosNestaSessao.has(lote)) return window.abrirModalErro("Lote já faturado.");
        window.lotesValidadosNestaSessao.add(lote); 
        
        pessoa.lotesPendentes = pessoa.lotesPendentes.filter(l => l !== lote);
        pessoa.lotesVendidos.push(lote);
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Faturamento processado com sucesso!"); 
        window.registrarLog("Venda", `Lote ${lote} validado para ${pessoa.nome} (${tipo}) por R$ 20,00`);
        
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM(); 

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'venda', lote: lote, nome: pessoa.nome, tipoPessoa: tipo, vPix: vPix, vDin: vDin, responsavel: userName })
        }).catch(err => console.error("Erro no envio", err));
    }

    window.confirmarDevolucaoLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const tipo = document.getElementById('modalAcaoLote').getAttribute('data-tipo');
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx];
        
        if(window.lotesValidadosNestaSessao.has(lote)) return window.abrirModalErro("Lote já processado.");
        window.lotesValidadosNestaSessao.add(lote);

        pessoa.lotesPendentes = pessoa.lotesPendentes.filter(l => l !== lote);
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Retorno de lote concluído!"); 
        window.registrarLog("Devolução", `Lote ${lote} retornado por ${pessoa.nome} (${tipo})`);
        
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'devolucao', lote: lote, nome: pessoa.nome, tipoPessoa: tipo, responsavel: userName })
        }).catch(err => console.error("Erro no envio", err));
    }

    if (document.getElementById("adminPage") || document.getElementById("educadorPage")) window.carregarDadosDoBanco();
});
