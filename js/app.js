document.addEventListener("DOMContentLoaded", () => {
    
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    // ==========================================
    // CONFIGURAÇÕES GERAIS E APIS
    // ==========================================
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const IMGBB_API_KEY = '699c158483746240a585454fdfb09cac';
    
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    
    window.fotoFileGlobal = null; let cropperInstancia = null;
    let estoqueChartInstEdu = null; let financeiroChartInstEdu = null;
    let estoqueChartInstAdm = null; let financeiroChartInstAdm = null;

    window.caixaGlobal = { pixReais: 0.00, dinReais: 0.00 };
    window.caixaGlobalBD = []; 
    window.todosEducandosBD = []; window.mockEducadoresBD = [];
    window.mockParceirosBD = []; window.lotesSedeBD = []; window.logsDoSistema = [];

    window.registrarLog = function(acao, detalhe) {
        const dataHora = new Date().toLocaleString('pt-BR');
        const sessao = window.innerWidth <= 768 ? 'Mobile' : 'Desktop';
        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'registrar_log', dataHora, responsavel: userName, sessao, acao, detalhe, localizacao: 'Sistema Web' })
        }).catch(e => console.error("Erro log", e));
    }

    // ==========================================
    // SISTEMA CUSTOM SELECTS
    // ==========================================
    document.addEventListener('input', (e) => {
        if(e.target.classList.contains('search-custom-select')) {
            const term = e.target.value.toLowerCase();
            const options = e.target.closest('.custom-options').querySelectorAll('.custom-option');
            options.forEach(opt => {
                if(opt.textContent.toLowerCase().includes(term)) opt.style.display = 'block';
                else opt.style.display = 'none';
            });
        }
    });

    window.bindOptionClick = function(e) {
        const option = e.currentTarget;
        const wrapperNode = option.closest('.custom-select-wrapper');
        if (!wrapperNode) return;
        const select = wrapperNode.querySelector('.custom-select');
        const triggerText = wrapperNode.querySelector('.trigger-text');
        const hiddenInput = wrapperNode.querySelector('input[type="hidden"]');
        
        triggerText.textContent = option.textContent;
        hiddenInput.value = option.getAttribute('data-value');
        
        wrapperNode.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        select.classList.remove('open');
        triggerText.style.color = "var(--dim-grey)"; 
        
        const searchInput = wrapperNode.querySelector('.search-custom-select');
        if(searchInput) {
            searchInput.value = '';
            wrapperNode.querySelectorAll('.custom-option').forEach(opt => opt.style.display = 'block');
        }

        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        e.stopPropagation();
    }

    function ativarEventosSelectCustomizado(wrapperNode) {
        const options = wrapperNode.querySelectorAll('.custom-option');
        options.forEach(option => {
            option.removeEventListener('click', window.bindOptionClick);
            option.addEventListener('click', window.bindOptionClick);
        });
    }

    const customSelectWrappers = document.querySelectorAll('.custom-select-wrapper');
    customSelectWrappers.forEach(wrapper => {
        const select = wrapper.querySelector('.custom-select');
        const trigger = wrapper.querySelector('.custom-select-trigger');
        if(trigger) {
            trigger.addEventListener('click', (e) => {
                document.querySelectorAll('.custom-select').forEach(s => { if (s !== select) s.classList.remove('open'); });
                select.classList.toggle('open');
                e.stopPropagation();
            });
            ativarEventosSelectCustomizado(wrapper);
        }
    });

    window.addEventListener('click', () => { document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open')); });

    // ==========================================
    // O SEGREDO DA NAVEGAÇÃO CORRIGIDO AQUI!
    // ==========================================
    window.mudarAbaEducador = function(secId, navId) {
        // 1. Esconde TODAS as sections filhas do painel principal (dinâmico, sem nomes fixos)
        const todasSecoes = document.querySelectorAll('main.admin-container > section');
        todasSecoes.forEach(sec => sec.style.display = 'none');
        
        // 2. Remove o destaque de todos os itens do menu lateral
        const todosNavs = document.querySelectorAll('.sidebar-nav .nav-item');
        todosNavs.forEach(nav => nav.classList.remove('active'));
        
        // 3. Mostra a tela correta e destaca o menu correto
        const secClicada = document.getElementById(secId);
        if(secClicada) secClicada.style.display = 'block';
        
        const navClicado = document.getElementById(navId);
        if(navClicado) navClicado.classList.add('active');
        
        // 4. Se for celular, fecha o menu automaticamente
        if(window.innerWidth <= 768) { 
            const side = document.getElementById('sidebar');
            if(side) side.classList.remove('open'); 
        }
        
        // 5. Atualiza os dados da tela clicada
        if(document.getElementById("educadorPage") && window.atualizarDashboardEducador) window.atualizarDashboardEducador();
        if(document.getElementById("adminPage") && window.atualizarDashboardsADM) window.atualizarDashboardsADM();
    }

    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    if(sidebar) {
        if(openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
        if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
    }

    // ==========================================
    // CARGA DE DADOS DO SHEETS
    // ==========================================
    window.carregarDadosDoBanco = function(recarregarTelas = true) {
        const btnSync = document.getElementById('nomeEducador');
        if(btnSync) btnSync.innerText = "Sincronizando Banco...";

        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                window.lotesSedeBD = data.lotesSede.map(l => ({
                    codigo: l['Codigo_Lote'] || l['ID do Lote'], educador: l['Responsavel_Atual'] || l['Educador_Destino'] || ''
                })).filter(l => l.codigo);

                window.todosEducandosBD = data.educandos.map(e => ({
                    nome: e['Nome_Educando'] || e['Nome'], curso: e['Curso'], turma: e['Turma'], periodo: e['Periodo'], 
                    educadorResponsavel: e['Educador_Responsavel'] || '',
                    cadastroAtivo: e['Cadastro_Ativo'] || '',
                    foto: e['Foto_URL'] && String(e['Foto_URL']).trim() !== '' ? e['Foto_URL'] : `https://ui-avatars.com/api/?name=${e['Nome_Educando'] || e['Nome']}&background=BC68A1&color=fff`,
                    lotesPendentes: e['Lotes_Pendentes'] ? String(e['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: e['Lotes_Vendidos'] ? String(e['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: e['Lotes_Devolvidos'] ? String(e['Lotes_Devolvidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    cartelasEntregues: parseInt(e['Cartelas_Entregue']) || 0
                }));

                window.mockEducadoresBD = data.educadores.map(e => {
                    let vendidos = 0; let pendentes = 0;
                    window.todosEducandosBD.forEach(al => {
                        if(textoIgual(al.educadorResponsavel, e['Nome'])) { vendidos += al.lotesVendidos.length; pendentes += al.lotesPendentes.length; }
                    });
                    let retiradosSede = window.lotesSedeBD.filter(l => textoIgual(l.educador, e['Nome'])).length;
                    return { nome: e['Nome'], curso: e['Curso Responsavel'], lotesRetiradosSede: retiradosSede, lotesVendidos: vendidos, lotesPendentes: pendentes };
                });

                window.caixaGlobal = { pixReais: 0, dinReais: 0 };
                window.caixaGlobalBD = data.caixaGlobal || []; 
                if (data.caixaGlobal) {
                    data.caixaGlobal.forEach(transacao => {
                        let valor = parseFloat(transacao['Valor']) || parseFloat(transacao['Valor_Total']) || 0;
                        if(transacao['Metodo_Pagamento'] === 'PIX') window.caixaGlobal.pixReais += valor;
                        if(transacao['Metodo_Pagamento'] === 'Dinheiro') window.caixaGlobal.dinReais += valor;
                    });
                }
                
                window.logsDoSistema = data.logs || [];

                if(btnSync) btnSync.innerText = userName;
                if (recarregarTelas) {
                    if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
                    if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
                }
            }
        }).catch(err => { console.error(err); if(btnSync) btnSync.innerText = "Erro de Conexão"; });
    }

    // ==========================================
    // LOGIN
    // ==========================================
    const loginForm = document.getElementById("loginForm");
    if(loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault(); 
            const educadorInput = document.getElementById('educadorSelect') || document.querySelector('input[type="hidden"]');
            const educador = educadorInput ? educadorInput.value : null;
            const senha = document.getElementById("senhaInput").value;

            if(!educador || senha.length !== 6) return window.abrirModalErro("Selecione seu nome e digite 6 números.");
            const btn = document.querySelector(".btn-primary");
            btn.innerText = "Conectando..."; btn.disabled = true;

            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'login', educador: educador, senha: senha }) })
            .then(res => res.json()).then(data => {
                if (data.success) { 
                    localStorage.setItem('usuarioLogado', educador);
                    window.registrarLog("Login", "Acessou o sistema com sucesso.");
                    window.location.href = (data.nivelAcesso === "ADM") ? "admin.html" : "educador.html"; 
                } else { btn.innerText = "Acessar Sistema"; btn.disabled = false; window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; btn.innerText = "Acessar Sistema"; window.abrirModalErro("Erro de rede."); });
        });
    }

    function calcularRecompensas(qtdVendidos) {
        let fone = qtdVendidos >= 10 ? 1 : 0;
        let cartelas = qtdVendidos >= 10 ? 1 + Math.floor((qtdVendidos - 10) / 5) : 0;
        return { fone, cartelas };
    }

    // ==========================================
    // SISTEMA DE CORTE DE FOTOS (CADASTRO E EDIÇÃO)
    // ==========================================
    window.iniciarCorteFoto = function(event) {
        const input = event.target;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgToCrop = document.getElementById('imagemParaCorte');
                imgToCrop.src = e.target.result;
                window.modoEdicaoFoto = false; 
                abrirModal('modalCorteFoto');
                if(cropperInstancia) cropperInstancia.destroy();
                cropperInstancia = new Cropper(imgToCrop, { aspectRatio: 1, viewMode: 1 });
            }
            reader.readAsDataURL(input.files[0]);
        }
        input.value = ''; 
    }

    window.iniciarCorteEdicao = function(event) {
        const input = event.target;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgToCrop = document.getElementById('imagemParaCorte');
                imgToCrop.src = e.target.result;
                window.modoEdicaoFoto = true; 
                abrirModal('modalCorteFoto');
                if(cropperInstancia) cropperInstancia.destroy();
                cropperInstancia = new Cropper(imgToCrop, { aspectRatio: 1, viewMode: 1 });
            }
            reader.readAsDataURL(input.files[0]);
        }
        input.value = ''; 
    }

    const btnConfirmarCorte = document.getElementById('btnConfirmarCorte');
    if(btnConfirmarCorte) {
        btnConfirmarCorte.addEventListener('click', (e) => {
            e.preventDefault();
            if(cropperInstancia) {
                if (window.modoEdicaoFoto && window.alunoEmFocoIdx !== null) {
                    btnConfirmarCorte.innerText = "Enviando Foto...";
                    btnConfirmarCorte.disabled = true;

                    cropperInstancia.getCroppedCanvas({ width: 300, height: 300 }).toBlob((blob) => {
                        const formData = new FormData(); formData.append('image', blob);
                        fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_API_KEY, { method: 'POST', body: formData })
                        .then(r => r.json()).then(dataImg => {
                            const urlDaFoto = dataImg.data.url;
                            const aluno = window.todosEducandosBD[window.alunoEmFocoIdx];
                            
                            aluno.foto = urlDaFoto;
                            document.getElementById('detalheFoto').src = urlDaFoto;
                            if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
                            if(document.getElementById("adminPage")) window.atualizarDashboardsADM();

                            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atualizar_foto', nomeAluno: aluno.nome, fotoUrl: urlDaFoto }) });
                            
                            fecharModal('modalCorteFoto');
                            window.abrirModalSucesso("Foto do aluno atualizada!");
                            window.registrarLog("Atualização de Foto", `Alterou a foto do aluno ${aluno.nome}`);
                        }).finally(() => {
                            btnConfirmarCorte.innerText = "Cortar e Salvar Foto";
                            btnConfirmarCorte.disabled = false;
                            window.modoEdicaoFoto = false;
                        });
                    }, 'image/jpeg');

                } else {
                    cropperInstancia.getCroppedCanvas({ width: 300, height: 300 }).toBlob((blob) => {
                        window.fotoFileGlobal = blob;
                        document.getElementById('previewFoto').src = URL.createObjectURL(blob);
                        document.getElementById('previewFoto').style.display = 'block';
                        document.getElementById('iconCamera').style.display = 'none';
                        fecharModal('modalCorteFoto');
                    }, 'image/jpeg');
                }
            }
        });
    }

    // ==========================================
    // LÓGICA DO EDUCADOR 
    // ==========================================
    const educadorPage = document.getElementById("educadorPage");
    if (educadorPage) {
        document.getElementById('nomeEducador').innerText = userName;
        window.carregarDadosDoBanco();

        const buscaNome = document.getElementById('buscaNomeAluno');
        const filtroTurma = document.getElementById('filtroTurmaAluno');
        if(buscaNome) buscaNome.addEventListener('input', () => window.atualizarDashboardEducador());
        if(filtroTurma) filtroTurma.addEventListener('change', () => window.atualizarDashboardEducador());

        window.atualizarDashboardEducador = function() {
            let meusAlunosAtivos = window.todosEducandosBD.filter(a => 
                textoIgual(a.educadorResponsavel, userName) && 
                (a.cadastroAtivo.toLowerCase() === 'sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0)
            ); 
            
            if(buscaNome && buscaNome.value.trim() !== "") {
                const termo = buscaNome.value.toLowerCase();
                meusAlunosAtivos = meusAlunosAtivos.filter(a => a.nome.toLowerCase().includes(termo));
            }
            if(filtroTurma && filtroTurma.value !== "Todas") {
                meusAlunosAtivos = meusAlunosAtivos.filter(a => a.turma === filtroTurma.value);
            }

            const tabela = document.getElementById("tabelaAlunos");
            if (tabela) {
                tabela.innerHTML = "";
                meusAlunosAtivos.forEach((aluno, index) => {
                    const rec = calcularRecompensas(aluno.lotesVendidos.length);
                    const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas} <span class="material-symbols-outlined icon-filled" style="font-size: 1.1rem; vertical-align: middle;">description</span></div>` : '-';
                    const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
                    
                    tabela.innerHTML += `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})"><td class="td-center" style="font-weight: bold; color: #BC68A1;">${index + 1}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong><br><small style="color:#a0a0a0">${aluno.curso}</small></td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
                });
                if(meusAlunosAtivos.length === 0) tabela.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno ativo encontrado na busca.</td></tr>';
            }

            let totalPendentesGeral = 0, totalVendidosGeral = 0;
            window.todosEducandosBD.forEach(a => { totalPendentesGeral += a.lotesPendentes.length; totalVendidosGeral += a.lotesVendidos.length; });

            const meuPerfil = window.mockEducadoresBD.find(e => textoIgual(e.nome, userName));
            if(meuPerfil) {
                const disponivel = meuPerfil.lotesRetiradosSede - (meuPerfil.lotesVendidos + meuPerfil.lotesPendentes);
                if(document.getElementById('kpiEducadorVendidos')) document.getElementById('kpiEducadorVendidos').innerText = meuPerfil.lotesVendidos;
                if(document.getElementById('kpiEducadorPendentes')) document.getElementById('kpiEducadorPendentes').innerText = meuPerfil.lotesPendentes;
                if(document.getElementById('kpiEducadorEstoque')) document.getElementById('kpiEducadorEstoque').innerText = disponivel >= 0 ? disponivel : 0;
            }

            const vVendasPix = window.caixaGlobal.pixReais; const vVendasDin = window.caixaGlobal.dinReais;
            const vVendas = vVendasPix + vVendasDin; const vPendentes = totalPendentesGeral * 20.00;
            if(document.getElementById('kpiVendasReaisGlobal')) document.getElementById('kpiVendasReaisGlobal').innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaPix')) document.getElementById('kpiCaixaPix').innerText = `R$ ${vVendasPix.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaDinheiro')) document.getElementById('kpiCaixaDinheiro').innerText = `R$ ${vVendasDin.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiProjecaoGlobal')) document.getElementById('kpiProjecaoGlobal').innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiLotesRua')) document.getElementById('kpiLotesRua').innerText = totalPendentesGeral;

            const ctxEst = document.getElementById('estoqueChartEdu');
            if (ctxEst && ctxEst.offsetParent !== null) { 
                if (!estoqueChartInstEdu) estoqueChartInstEdu = new Chart(ctxEst.getContext('2d'), { type: 'doughnut', data: { labels: ['Válidos', 'Pendentes', 'Estoque'], datasets: [{ data: [totalVendidosGeral, totalPendentesGeral, 440], backgroundColor: ['#BC68A1', '#F4B841', '#e0e0e0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
                else { estoqueChartInstEdu.data.datasets[0].data = [totalVendidosGeral, totalPendentesGeral, 440]; estoqueChartInstEdu.update(); }
            }
            const ctxFin = document.getElementById('financeiroChartEdu');
            if (ctxFin && ctxFin.offsetParent !== null) {
                if (!financeiroChartInstEdu) financeiroChartInstEdu = new Chart(ctxFin.getContext('2d'), { type: 'bar', data: { labels: ['Caixa Realizado', 'Projeção Restante'], datasets: [{ label: 'Valor em R$', data: [vVendas, vPendentes], backgroundColor: ['#BC68A1', '#F4B841'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
                else { financeiroChartInstEdu.data.datasets[0].data = [vVendas, vPendentes]; financeiroChartInstEdu.update(); }
            }

            const tabelaRanking = document.getElementById("tabelaRankingEducador");
            if(tabelaRanking) {
                tabelaRanking.innerHTML = "";
                let rankingGeral = [...window.todosEducandosBD].filter(a => a.lotesVendidos.length > 0).sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
                rankingGeral.forEach((aluno, index) => {
                    const destaque = textoIgual(aluno.educadorResponsavel, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
                    const tagMeu = textoIgual(aluno.educadorResponsavel, userName) ? ' <span style="font-size:0.7rem; background:var(--petal-pink); color:white; padding:2px 4px; border-radius:4px;">Seu Aluno</span>' : '';
                    const rec = calcularRecompensas(aluno.lotesVendidos.length);
                    const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas}</div>` : '-';
                    const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
                    tabelaRanking.innerHTML += `<tr style="${destaque}" onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})"><td class="td-center" style="font-weight: bold;">${index + 1}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong>${tagMeu}</td><td>${aluno.turma}</td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
                });
            }
            const tabelaRankingEducadores = document.getElementById('tabelaRankingEducadoresLista');
            if(tabelaRankingEducadores) {
                tabelaRankingEducadores.innerHTML = "";
                let rankingProf = [...window.mockEducadoresBD].sort((a, b) => b.lotesVendidos - a.lotesVendidos);
                rankingProf.forEach((prof, index) => {
                    const destaque = textoIgual(prof.nome, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
                    tabelaRankingEducadores.innerHTML += `<tr style="${destaque}"><td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${index + 1}º</td><td><strong>${prof.nome}</strong></td><td style="color: var(--dim-grey);">${prof.curso}</td><td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${prof.lotesVendidos}</td></tr>`;
                });
            }

            let searchBox = `<div style="padding: 10px; position: sticky; top: 0; background: white; border-bottom: 1px solid #eee; z-index: 2;"><input type="text" class="purple-input search-custom-select" placeholder="Pesquisar nome..." style="padding: 0.5rem; font-size: 0.9rem;" onclick="event.stopPropagation()"></div>`;

            const todosMeusAlunosDB = window.todosEducandosBD.filter(a => textoIgual(a.educadorResponsavel, userName));
            
            const selectNomeCadastro = document.getElementById("opcoesNomeEducando");
            const wrapCad = document.getElementById("wrapperNomeEducando");
            if(selectNomeCadastro && wrapCad) {
                let optsCad = searchBox;
                if (todosMeusAlunosDB.length === 0) {
                    optsCad += '<span class="custom-option" data-value="">Nenhum aluno atrelado à você no banco.</span>';
                } else {
                    todosMeusAlunosDB.forEach(a => { 
                        let lblFoto = a.foto.includes('ui-avatars') ? '<span style="color:#a0a0a0; font-size: 0.8rem;">(Sem Foto)</span>' : '<span style="color:var(--petal-pink); font-size: 0.8rem;">(Editar Foto)</span>';
                        optsCad += `<span class="custom-option" data-value="${a.nome}">${a.nome} - ${lblFoto}</span>`; 
                    });
                }
                selectNomeCadastro.innerHTML = optsCad;
                ativarEventosSelectCustomizado(wrapCad);
            }

            const selectAlunoAtribuir = document.getElementById("opcoesAlunoAtribuir");
            const wrapAttr = document.getElementById("wrapperAlunoAtribuir");
            if (selectAlunoAtribuir && wrapAttr) {
                let optsAttr = searchBox;
                if(meusAlunosAtivos.length === 0) {
                    optsAttr += '<span class="custom-option" data-value="">Nenhum aluno ativo.</span>';
                } else {
                    meusAlunosAtivos.forEach(a => { optsAttr += `<span class="custom-option" data-value="${a.nome}">${a.nome}</span>`; });
                }
                selectAlunoAtribuir.innerHTML = optsAttr;
                ativarEventosSelectCustomizado(wrapAttr);
            }

            const listaLotes = document.getElementById("listaLotesCheckboxes");
            if(listaLotes) {
                let htmlLotes = '';
                let lotesEmUso = [];
                window.todosEducandosBD.forEach(a => { lotesEmUso.push(...a.lotesPendentes); lotesEmUso.push(...a.lotesVendidos); });
                const meusLotes = window.lotesSedeBD.filter(l => textoIgual(l.educador, userName) || l.educador === '');
                
                meusLotes.forEach(l => { 
                    if(lotesEmUso.includes(l.codigo)) {
                        htmlLotes += `<label class="checkbox-item-row" style="opacity: 0.5; cursor: not-allowed;" title="Lote já em uso"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}" disabled> <span style="color: var(--dim-grey); font-weight: 500; text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:#a0a0a0;">Em uso</span></label>`; 
                    } else {
                        htmlLotes += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span style="color: var(--dim-grey); font-weight: 500;">${l.codigo}</span></label>`; 
                    }
                });
                listaLotes.innerHTML = htmlLotes || '<div style="padding: 15px; color:#a0a0a0; text-align:center;">Nenhum lote liberado para você na Sede.</div>';
            }
        };

        const formCadastrarEducando = document.getElementById("formCadastrarEducando");
        if(formCadastrarEducando) {
            formCadastrarEducando.addEventListener("submit", (e) => {
                e.preventDefault();
                const btn = formCadastrarEducando.querySelector("button[type='submit']");
                btn.innerText = "Enviando Foto (Aguarde)..."; btn.disabled = true;

                const nome = document.getElementById("nomeSelectEducando").value;
                const turmaTexto = document.getElementById("turmaSelectEducando").value; 
                if(!nome || !turmaTexto) { btn.disabled = false; btn.innerText = "Ativar Educando"; return window.abrirModalErro("Preencha todos os campos."); }

                let periodo = (turmaTexto === "Turma 3" || turmaTexto === "Turma 4") ? "Tarde" : "Manhã";

                if(window.fotoFileGlobal && IMGBB_API_KEY) {
                    const formData = new FormData();
                    formData.append('image', window.fotoFileGlobal);
                    
                    fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_API_KEY, { method: 'POST', body: formData })
                    .then(r => r.json())
                    .then(dataImg => {
                        const urlDaFoto = dataImg.data.url;
                        salvarEducandoBanco(nome, turmaTexto, periodo, urlDaFoto, btn);
                    })
                    .catch(err => { console.error(err); salvarEducandoBanco(nome, turmaTexto, periodo, "", btn); });
                } else {
                    salvarEducandoBanco(nome, turmaTexto, periodo, "", btn);
                }
            });
        }

        function salvarEducandoBanco(nome, turmaTexto, periodo, fotoUrl, btn) {
            btn.innerText = "Salvando Dados...";
            fetch(SCRIPT_URL, {
                method: 'POST', body: JSON.stringify({ action: 'cadastrar_educando', nome: nome, turma: turmaTexto, periodo: periodo, educadorResponsavel: userName, fotoUrl: fotoUrl })
            }).then(res => res.json()).then(data => {
                btn.innerText = "Ativar Educando"; btn.disabled = false;
                if(data.success) {
                    window.registrarLog("Cadastro/Edição de Foto", `Atualizou a foto/cadastro do aluno ${nome}`);
                    fecharModal('modalCadastrarEducando'); formCadastrarEducando.reset();
                    window.fotoFileGlobal = null; document.getElementById('previewFoto').style.display = 'none'; document.getElementById('iconCamera').style.display = 'block';
                    window.abrirModalSucesso(data.message); window.carregarDadosDoBanco();
                } else { window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; btn.innerText = "Ativar Educando"; window.abrirModalErro("Erro de rede."); });
        }

        const formAtribuirLote = document.getElementById("formAtribuirLote");
        if(formAtribuirLote) {
            formAtribuirLote.addEventListener("submit", (e) => {
                e.preventDefault();
                const alunoInput = document.getElementById("alunoAtribuirSelect").value;
                const checkboxesMarcados = document.querySelectorAll('#listaLotesCheckboxes input[type="checkbox"]:checked');
                const lotesArray = Array.from(checkboxesMarcados).map(cb => cb.value);

                if(!alunoInput || lotesArray.length === 0) return window.abrirModalErro("Selecione o aluno e marque pelo menos um lote.");
                const btn = formAtribuirLote.querySelector("button[type='submit']");
                btn.innerText = "Atribuindo..."; btn.disabled = true;

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atribuir_lote', nomeAluno: alunoInput, lotes: lotesArray }) })
                .then(res => res.json()).then(data => {
                    btn.innerText = "Confirmar Atribuição"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Atribuição de Lote", `Atribuiu os lotes ${lotesArray.join(', ')} para ${alunoInput}`);
                        fecharModal('modalAtribuirLote'); formAtribuirLote.reset(); window.abrirModalSucesso("Lotes atribuídos!"); window.carregarDadosDoBanco(); 
                    } else { window.abrirModalErro(data.message); }
                }).catch(err => { btn.disabled = false; btn.innerText = "Confirmar Atribuição"; window.abrirModalErro("Erro de rede."); });
            });
        }
    }

    // ==========================================
    // LÓGICA DO ADM 
    // ==========================================
    const adminPage = document.getElementById("adminPage");
    if (adminPage) {
        window.carregarDadosDoBanco();
        
        window.atualizarDashboardsADM = function() {
            let totalPendentes = 0, totalVendidos = 0; let ativos = 0; let inativos = 0; let totalAlunos = window.todosEducandosBD.length;
            window.todosEducandosBD.forEach(a => { 
                totalPendentes += a.lotesPendentes.length; totalVendidos += a.lotesVendidos.length; 
                if(a.cadastroAtivo === 'Sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0) ativos++; else inativos++;
            });

            const vVendasPix = window.caixaGlobal.pixReais; const vVendasDin = window.caixaGlobal.dinReais;
            const vVendas = vVendasPix + vVendasDin; const vPendentes = totalPendentes * 20.00;

            if(document.getElementById('kpiVendasReaisGlobal')) document.getElementById('kpiVendasReaisGlobal').innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaPix')) document.getElementById('kpiCaixaPix').innerText = `R$ ${vVendasPix.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiCaixaDinheiro')) document.getElementById('kpiCaixaDinheiro').innerText = `R$ ${vVendasDin.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiProjecaoGlobal')) document.getElementById('kpiProjecaoGlobal').innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;
            if(document.getElementById('kpiLotesRua')) document.getElementById('kpiLotesRua').innerText = totalPendentes;

            if(document.getElementById('kpiAtivos')) document.getElementById('kpiAtivos').innerText = ativos;
            if(document.getElementById('kpiInativos')) document.getElementById('kpiInativos').innerText = inativos;
            if(document.getElementById('kpiAdesao')) document.getElementById('kpiAdesao').innerText = totalAlunos > 0 ? `${Math.round((ativos/totalAlunos)*100)}%` : '0%';

            let maiorEstoqueNome = "Nenhum"; let maiorEstoqueQtd = -1;
            window.mockEducadoresBD.forEach(ed => {
                let est = ed.lotesRetiradosSede - ed.lotesVendidos - ed.lotesPendentes;
                if (est > maiorEstoqueQtd) { maiorEstoqueQtd = est; maiorEstoqueNome = ed.nome; }
            });
            if(document.getElementById('kpiMaiorEstoque')) document.getElementById('kpiMaiorEstoque').innerHTML = `<strong>${maiorEstoqueNome}</strong> <br><span style="font-size: 1rem; color: var(--dim-grey); font-weight: normal;">${maiorEstoqueQtd} lotes disponíveis</span>`;

            const ctxEst = document.getElementById('estoqueChart');
            if (ctxEst && ctxEst.offsetParent !== null) { 
                if (!estoqueChartInstAdm) estoqueChartInstAdm = new Chart(ctxEst.getContext('2d'), { type: 'doughnut', data: { labels: ['Válidos', 'Pendentes', 'Estoque'], datasets: [{ data: [totalVendidos, totalPendentes, 440], backgroundColor: ['#BC68A1', '#F4B841', '#e0e0e0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
                else { estoqueChartInstAdm.data.datasets[0].data = [totalVendidos, totalPendentes, 440]; estoqueChartInstAdm.update(); }
            }
            const ctxFin = document.getElementById('financeiroChart');
            if (ctxFin && ctxFin.offsetParent !== null) {
                if (!financeiroChartInstAdm) financeiroChartInstAdm = new Chart(ctxFin.getContext('2d'), { type: 'bar', data: { labels: ['Caixa Realizado', 'Projeção Restante'], datasets: [{ label: 'Valor em R$', data: [vVendas, vPendentes], backgroundColor: ['#BC68A1', '#F4B841'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
                else { financeiroChartInstAdm.data.datasets[0].data = [vVendas, vPendentes]; financeiroChartInstAdm.update(); }
            }

            let htmlGestao = "";
            window.todosEducandosBD.forEach((aluno, indexOrig) => {
                if (aluno.lotesPendentes.length > 0) {
                    htmlGestao += `<tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${indexOrig})"><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong></td><td style="color:var(--dim-grey);">${aluno.curso}<br><small style="color:#a0a0a0">${aluno.turma}</small></td><td class="td-center highlight-yellow" style="font-weight:bold; font-size:1.1rem;">${aluno.lotesPendentes.length}</td></tr>`;
                }
            });
            if(document.getElementById('tabelaGestaoLotes')) document.getElementById('tabelaGestaoLotes').innerHTML = htmlGestao || `<tr><td colspan="4" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhum lote pendente.</td></tr>`;

            const tabelaRankingAlunosADM = document.getElementById('tabelaRankingAlunosADM');
            if(tabelaRankingAlunosADM) {
                tabelaRankingAlunosADM.innerHTML = "";
                let rankingGlobal = [...window.todosEducandosBD].sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
                rankingGlobal.forEach((aluno, index) => {
                    const rec = calcularRecompensas(aluno.lotesVendidos.length);
                    if(aluno.lotesVendidos.length === 0 && aluno.lotesPendentes.length === 0) return; 
                    const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas}</div>` : '-';
                    const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
                    tabelaRankingAlunosADM.innerHTML += `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)})"><td class="td-center" style="font-weight: bold;">${index + 1}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong></td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
                });
            }

            const tabelaRankingEducadoresADM = document.getElementById('tabelaRankingEducadoresADM');
            if(tabelaRankingEducadoresADM) {
                tabelaRankingEducadoresADM.innerHTML = "";
                let rankingProf = [...window.mockEducadoresBD].sort((a, b) => b.lotesVendidos - a.lotesVendidos);
                rankingProf.forEach((prof, index) => {
                    tabelaRankingEducadoresADM.innerHTML += `<tr><td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${index + 1}º</td><td><strong>${prof.nome}</strong></td><td style="color: var(--dim-grey);">${prof.curso}</td><td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${prof.lotesVendidos}</td></tr>`;
                });
            }

            const tabelaCaixa = document.getElementById('tabelaLivroCaixa');
            if(tabelaCaixa && window.caixaGlobalBD) {
                tabelaCaixa.innerHTML = window.caixaGlobalBD.reverse().map(tx => {
                    const dt = tx['Data/Hora'] || tx['Data_Hora'] || tx['Data'] || '-';
                    const id = tx['ID_Transacao'] || tx['ID'] || '-';
                    const lote = tx['Lote'] || tx['Codigo_Lote'] || '-';
                    const edu = tx['Educando'] || tx['Aluno'] || '-';
                    const val = parseFloat(tx['Valor'] || 0).toFixed(2).replace('.', ',');
                    const met = tx['Metodo_Pagamento'] || tx['Método'] || tx['Metodo'] || '-';
                    const resp = tx['Responsavel'] || tx['Educador Responsavel'] || '-';
                    return `<tr><td>${dt}</td><td><span style="color:#a0a0a0; font-size:0.8rem;">${id}</span></td><td><strong>${lote}</strong></td><td>${edu}</td><td class="highlight-purple" style="font-weight:bold;">R$ ${val}</td><td>${met}</td><td>${resp}</td></tr>`;
                }).join('');
            }

            // CORREÇÃO DOS NOMES NAS COLUNAS DE LOG
            const tabelaLogs = document.getElementById('tabelaLogs');
            if(tabelaLogs && window.logsDoSistema) {
                tabelaLogs.innerHTML = window.logsDoSistema.map(l => {
                    const dt = l['Data/Hora'] || l['Data_Hora'] || l['Data Hora'] || l['Data'] || '-';
                    const resp = l['Responsavel'] || l['Responsável'] || l['Usuário'] || l['Usuario'] || '-';
                    const sessao = l['Sessão_Dispositivo'] || l['Sessao'] || l['Sessao Dispositivo'] || '-';
                    const acao = l['Ação_Registrada'] || l['Acao'] || l['Ação'] || l['Acao Registrada'] || '-';
                    const det = l['Detalhes'] || l['Detalhe'] || '-';
                    return `<tr><td style="color:var(--dim-grey); font-size:0.85rem;">${dt}</td><td><strong>${resp}</strong><br><small style="color:#ccc;">${sessao}</small></td><td style="color:var(--petal-pink); font-weight:bold;">${acao}</td><td style="color:var(--dim-grey);">${det}</td></tr>`;
                }).join('');
            }

            const listaSede = document.getElementById("listaLotesSede");
            if(listaSede) {
                let htmlSede = '';
                let lotesEmUso = [];
                window.todosEducandosBD.forEach(a => { lotesEmUso.push(...a.lotesPendentes); lotesEmUso.push(...a.lotesVendidos); });

                window.lotesSedeBD.forEach(l => {
                    const respInfo = l.educador ? ` (Com ${l.educador})` : ' (Na Sede)';
                    if(lotesEmUso.includes(l.codigo)) {
                        htmlSede += `<label class="checkbox-item-row" style="opacity: 0.5; cursor: not-allowed;" title="Em uso por um aluno"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}" disabled> <span style="color: var(--dim-grey); font-weight: 500; text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:#a0a0a0;">Em uso</span></label>`;
                    } else {
                        htmlSede += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span style="color: var(--dim-grey); font-weight: 500;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:var(--petal-pink);">${respInfo}</span></label>`;
                    }
                });
                listaSede.innerHTML = htmlSede || '<div style="padding: 15px; color:#a0a0a0; text-align:center;">Nenhum lote na base.</div>';
            }

            const opcoesEducador = document.getElementById("opcoesEducadorDestino");
            const wrapEdu = document.getElementById("wrapperEducadorDestino");
            if(opcoesEducador && wrapEdu) {
                let optsEdu = '<span class="custom-option" data-value="Sede">Devolver para Sede</span>';
                window.mockEducadoresBD.forEach(e => { optsEdu += `<span class="custom-option" data-value="${e.nome}">${e.nome}</span>`; });
                opcoesEducador.innerHTML = optsEdu;
                ativarEventosSelectCustomizado(wrapEdu);
            }
        };

        const formTransferirLote = document.getElementById("formTransferirLote");
        if(formTransferirLote) {
            formTransferirLote.addEventListener("submit", (e) => {
                e.preventDefault();
                const dest = document.getElementById("educadorDestinoVal").value;
                const checkboxes = document.querySelectorAll('#listaLotesSede input[type="checkbox"]:checked');
                const lotesSel = Array.from(checkboxes).map(cb => cb.value);

                if(!dest || lotesSel.length === 0) return window.abrirModalErro("Selecione os lotes e o destino.");
                const btn = formTransferirLote.querySelector("button[type='submit']");
                btn.innerText = "Transferindo..."; btn.disabled = true;

                window.registrarLog("Transferência (Sede)", `Transferiu lotes ${lotesSel.join(', ')} para o destino: ${dest}`);
                lotesSel.forEach(cod => { let l = window.lotesSedeBD.find(x => x.codigo === cod); if(l) l.educador = (dest === 'Sede' ? '' : dest); });
                
                fecharModal('modalTransferirLote'); window.abrirModalSucesso("Transferência realizada!");
                window.atualizarDashboardsADM(); formTransferirLote.reset();

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'transferir_lotes', lotes: lotesSel, educadorDestino: dest === 'Sede' ? '' : dest }) })
                .then(() => { btn.innerText = "Confirmar Transferência"; btn.disabled = false; })
                .catch(err => { console.error(err); btn.disabled = false; });
            });
        }
    }

    // ==========================================
    // MODAIS GENÉRICOS E TRANSAÇÕES
    // ==========================================
    window.abrirModal = function(id) { document.getElementById(id).classList.add('active'); }
    window.fecharModal = function(id) { document.getElementById(id).classList.remove('active'); }
    window.abrirModalSucesso = function(txt) { document.getElementById('textoModalSucesso').innerText = txt; abrirModal('modalSucesso'); }
    window.abrirModalErro = function(txt) { const pErro = document.getElementById('textoModalErro'); if(pErro) pErro.innerText = txt; abrirModal('modalErro'); }
    window.toggleMisto = function(mostrar) { document.getElementById('camposMisto').style.display = mostrar ? 'flex' : 'none'; }

    window.abrirDetalhesAluno = function(idx) {
        window.alunoEmFocoIdx = idx; 
        const isAdmin = document.getElementById('adminPage') !== null;
        const aluno = window.todosEducandosBD[idx]; 
        
        const elFoto = document.getElementById('detalheFoto'); if(elFoto) elFoto.src = aluno.foto;
        const elNome = document.getElementById('detalheNome'); if(elNome) elNome.innerText = aluno.nome;
        const elTurma = document.getElementById('detalheTurma'); if(elTurma) elTurma.innerText = `${aluno.curso} - ${aluno.turma}`;
        
        const recompensas = calcularRecompensas(aluno.lotesVendidos.length);
        const elFone = document.getElementById('detalheFone'); if(elFone) elFone.innerText = recompensas.fone;
        const elCartelas = document.getElementById('detalheCartelasGanhas'); if(elCartelas) elCartelas.innerText = recompensas.cartelas;
        
        let pendentesEntrega = recompensas.cartelas - aluno.cartelasEntregues;
        const boxRetirar = document.getElementById('boxRetirarCartela');
        if (boxRetirar) {
            if (pendentesEntrega > 0 && !isAdmin) { 
                boxRetirar.style.display = 'block';
                document.getElementById('detalheCartelasPendentes').innerText = pendentesEntrega;
                document.getElementById('btnRetirarCartela').onclick = () => window.registrarRetiradaCartela(idx);
            } else { boxRetirar.style.display = 'none'; }
        }

        const elVendidos = document.getElementById('detalheQtdVendidos'); if(elVendidos) elVendidos.innerText = aluno.lotesVendidos.length;
        const elPendentes = document.getElementById('detalheQtdPendentes'); if(elPendentes) elPendentes.innerText = aluno.lotesPendentes.length;
        const elDevolvidos = document.getElementById('detalheQtdDevolvidos'); if(elDevolvidos) elDevolvidos.innerText = aluno.lotesDevolvidos ? aluno.lotesDevolvidos.length : 0;
        
        const badgeVendidos = aluno.lotesVendidos.length ? aluno.lotesVendidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        let badgePendentes = '<span class="badge-lote vazio">Nenhum</span>';
        if(aluno.lotesPendentes.length) {
            if(isAdmin) {
                const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'block';
                badgePendentes = aluno.lotesPendentes.map(l => `<span class="badge-lote" style="border: 1px dashed var(--sunflower-gold); cursor:pointer;" title="Gerenciar Lote" onclick="abrirAcaoLote('${l}', ${idx}); event.stopPropagation();">${l} ⚙️</span>`).join('');
            } else {
                const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'none';
                badgePendentes = aluno.lotesPendentes.map(l => `<span class="badge-lote">${l}</span>`).join('');
            }
        } else {
            const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'none';
        }
        
        const badgeDevolvidos = aluno.lotesDevolvidos && aluno.lotesDevolvidos.length ? aluno.lotesDevolvidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        
        const bV = document.getElementById('detalheBadgesVendidos'); if(bV) bV.innerHTML = badgeVendidos;
        const bP = document.getElementById('detalheBadgesPendentes'); if(bP) bP.innerHTML = badgePendentes;
        const bD = document.getElementById('detalheBadgesDevolvidos'); if(bD) bD.innerHTML = badgeDevolvidos;
        
        abrirModal('modalDetalhesAluno');
    }

    window.registrarRetiradaCartela = function(idx) {
        const aluno = window.todosEducandosBD[idx];
        aluno.cartelasEntregues += 1; 
        window.registrarLog("Retirada Cartela Extra", `O Aluno ${aluno.nome} retirou +1 cartela física.`);
        abrirDetalhesAluno(idx); 
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'entregar_cartela', nomeAluno: aluno.nome }) }).catch(err => console.error(err));
    }

    window.abrirAcaoLote = function(lote, idxAluno) {
        const aluno = window.todosEducandosBD[idxAluno];
        document.getElementById('acaoLoteNome').innerText = lote;
        document.getElementById('acaoLoteAluno').innerText = aluno.nome;
        document.getElementById('acaoLoteInput').value = lote;
        document.getElementById('acaoAlunoIdxInput').value = idxAluno;
        
        const radioPix = document.querySelector('input[name="formaPagamentoLote"][value="PIX"]');
        if(radioPix) radioPix.checked = true;
        window.toggleMisto(false); document.getElementById('valorPixMisto').value = ''; document.getElementById('valorDinMisto').value = '';

        fecharModal('modalDetalhesAluno'); abrirModal('modalAcaoLote');
    }

    window.confirmarVendaLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const aluno = window.todosEducandosBD[idx];
        const formaPagamento = document.querySelector('input[name="formaPagamentoLote"]:checked').value;
        let vPix = 0, vDin = 0;

        if (formaPagamento === "PIX") { vPix = 20.00; } 
        else if (formaPagamento === "Dinheiro") { vDin = 20.00; } 
        else {
            vPix = parseFloat(document.getElementById('valorPixMisto').value) || 0;
            vDin = parseFloat(document.getElementById('valorDinMisto').value) || 0;
            if (vPix + vDin !== 20.00) return window.abrirModalErro(`A soma deve dar R$ 20,00.`);
        }

        window.caixaGlobal.pixReais += vPix; window.caixaGlobal.dinReais += vDin;
        aluno.lotesPendentes = aluno.lotesPendentes.filter(l => l !== lote);
        aluno.lotesVendidos.push(lote);
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Venda confirmada!"); 
        window.registrarLog("Validação de Venda", `Lote ${lote} validado para ${aluno.nome}. Pagamento: R$ ${vPix+vDin} via ${formaPagamento}`);
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM(); 
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'venda', lote: lote, nomeAluno: aluno.nome, vPix: vPix, vDin: vDin, responsavel: userName })
        }).catch(err => console.error("Erro", err));
    }

    window.confirmarDevolucaoLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const aluno = window.todosEducandosBD[idx];
        
        aluno.lotesPendentes = aluno.lotesPendentes.filter(l => l !== lote);
        if(!aluno.lotesDevolvidos) aluno.lotesDevolvidos = [];
        aluno.lotesDevolvidos.push(lote);
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Lote devolvido com sucesso!"); 
        window.registrarLog("Devolução Lote", `Lote ${lote} devolvido pelo aluno ${aluno.nome}`);
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'devolucao', lote: lote, nomeAluno: aluno.nome, responsavel: userName })
        }).catch(err => console.error("Erro", err));
    }
});
