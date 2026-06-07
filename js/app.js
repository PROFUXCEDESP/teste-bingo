document.addEventListener("DOMContentLoaded", () => {
    
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dliu0ck6y/image/upload'; 
    const CLOUDINARY_PRESET = 'bingo_2026';
    
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    
    window.fotoFileGlobal = null; 
    let cropperInstancia = null;
    window.alunoEmFocoIdx = null; 
    window.modoEdicaoFoto = false; 
    window.tipoCadastroFoto = 'aluno';
    window.tipoPessoaEmFoco = 'Educando';
    
    window.lotesValidadosNestaSessao = new Set(); 

    window.pages = {
        rankAdm: { current: 1, term: "" },
        gestaoLotes: { current: 1, term: "" },
        logs: { current: 1 },
        caixa: { current: 1 },
        rankProfAdm: { current: 1 },
        minhaTurma: { current: 1, term: "", turma: "Todas" },
        rankEdu: { current: 1, term: "" },
        rankProfEdu: { current: 1 },
        rankEquipe: { current: 1 }
    };

    let estoqueChartInstEdu = null; let financeiroChartInstEdu = null;
    let estoqueChartInstAdm = null; let financeiroChartInstAdm = null;

    window.caixaGlobal = { pixReais: 0.00, dinReais: 0.00 };
    window.caixaGlobalBD = []; 
    window.todosEducandosBD = []; window.mockEducadoresBD = [];
    window.todosParceirosBD = []; window.lotesSedeBD = []; window.logsDoSistema = [];

    window.renderPaginationUI = function(containerId, key, totalItems, itemsPerPage, renderFunc) {
        const container = document.getElementById(containerId);
        if(!container) return;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if(window.pages[key].current > totalPages) window.pages[key].current = totalPages;
        if(window.pages[key].current < 1) window.pages[key].current = 1;

        container.innerHTML = `
            <div class="discrete-pagination">
                <button class="btn-page-discrete" ${window.pages[key].current === 1 ? 'disabled' : ''} onclick="window.goPage('${key}', -1, '${renderFunc}')">&lt;</button>
                <input type="number" class="page-input-discrete" value="${window.pages[key].current}" min="1" max="${totalPages}" onchange="window.jumpPage('${key}', this, '${renderFunc}')">
                <span style="color:var(--dim-grey); font-size:0.9rem;">de ${totalPages}</span>
                <button class="btn-page-discrete" ${window.pages[key].current === totalPages ? 'disabled' : ''} onclick="window.goPage('${key}', 1, '${renderFunc}')">&gt;</button>
            </div>
        `;
    }

    window.goPage = (key, dir, func) => { window.pages[key].current += dir; if(window[func]) window[func](); };
    window.jumpPage = (key, input, func) => { 
        let val = parseInt(input.value) || 1;
        window.pages[key].current = val; 
        if(window[func]) window[func](); 
    };

    window.registrarLog = function(acao, detalhe) {
        const dataHora = new Date().toLocaleString('pt-BR');
        const sessao = window.innerWidth <= 768 ? 'Mobile' : 'Desktop';
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'registrar_log', dataHora, responsavel: userName, sessao, acao, detalhe, localizacao: 'Sistema Web' }) }).catch(e => console.error("Erro log", e));
    }

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
        if(searchInput) { searchInput.value = ''; wrapperNode.querySelectorAll('.custom-option').forEach(opt => opt.style.display = 'block'); }
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        e.stopPropagation();
    }

    function ativarEventosSelectCustomizado(wrapperNode) {
        const options = wrapperNode.querySelectorAll('.custom-option');
        options.forEach(option => { option.removeEventListener('click', window.bindOptionClick); option.addEventListener('click', window.bindOptionClick); });
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

    window.mudarAbaEducador = function(secId, navId) {
        const todasSecoes = document.querySelectorAll('main.admin-container > section');
        todasSecoes.forEach(sec => sec.style.display = 'none');
        const todosNavs = document.querySelectorAll('.sidebar-nav .nav-item');
        todosNavs.forEach(nav => nav.classList.remove('active'));
        const secClicada = document.getElementById(secId); if(secClicada) secClicada.style.display = 'block';
        const navClicado = document.getElementById(navId); if(navClicado) navClicado.classList.add('active');
        if(window.innerWidth <= 768) { const side = document.getElementById('sidebar'); if(side) side.classList.remove('open'); }
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

    window.carregarDadosDoBanco = function(recarregarTelas = true) {
        const btnSync = document.getElementById('nomeEducador');
        if(btnSync) btnSync.innerText = "Sincronizando...";

        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                window.lotesSedeBD = data.lotesSede.map(l => ({ codigo: l['Codigo_Lote'] || l['ID do Lote'], educador: l['Responsavel_Atual'] || l['Educador_Destino'] || '' })).filter(l => l.codigo);

                window.todosEducandosBD = data.educandos.map(e => ({
                    nome: e['Nome_Educando'] || e['Nome'], curso: e['Curso'], turma: e['Turma'], periodo: e['Periodo'], 
                    educadorResponsavel: e['Educador_Responsavel'] || '',
                    cadastroAtivo: e['Cadastro_Ativo'] || '',
                    foto: e['Foto_URL'] && String(e['Foto_URL']).trim() !== '' ? e['Foto_URL'] : `https://ui-avatars.com/api/?name=${encodeURIComponent(e['Nome_Educando'] || e['Nome'])}&background=BC68A1&color=fff`,
                    lotesPendentes: e['Lotes_Pendentes'] ? String(e['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: e['Lotes_Vendidos'] ? String(e['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: e['Lotes_Devolvidos'] ? String(e['Lotes_Devolvidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    cartelasEntregues: parseInt(e['Cartelas_Entregue']) || 0
                }));

                window.todosParceirosBD = (data.parceiros || []).map(p => ({
                    nome: p['Nome'], cartela: p['Cartela_Retirada'] || '', turma: 'Parceiro', curso: 'Comércio/Apoiador',
                    foto: `https://ui-avatars.com/api/?name=${encodeURIComponent(p['Nome'])}&background=4CAF50&color=fff`,
                    lotesPendentes: p['Lotes_Pendentes'] ? String(p['Lotes_Pendentes']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesVendidos: p['Lotes_Vendidos'] ? String(p['Lotes_Vendidos']).split(',').map(s=>s.trim()).filter(Boolean) : [],
                    lotesDevolvidos: []
                }));

                window.mockEducadoresBD = data.educadores.map(e => {
                    let vendidos = 0; let pendentes = 0;
                    window.todosEducandosBD.forEach(al => {
                        if(textoIgual(al.educadorResponsavel, e['Nome'])) { 
                            vendidos += al.lotesVendidos.length; 
                            pendentes += al.lotesPendentes.length; 
                        }
                    });
                    let retiradosSede = window.lotesSedeBD.filter(l => textoIgual(l.educador, e['Nome'])).length;
                    return { nome: e['Nome'], curso: e['Curso Responsavel'], lotesRetiradosSede: retiradosSede, lotesVendidos: vendidos, lotesPendentes: pendentes };
                });

                window.caixaGlobal = { pixReais: 0, dinReais: 0 };
                window.caixaGlobalBD = data.caixaGlobal || []; 
                if (data.caixaGlobal) {
                    data.caixaGlobal.forEach(transacao => {
                        let valor = parseFloat(transacao['Valor']) || parseFloat(transacao['Valor_Total']) || 0;
                        let m = String(transacao['Metodo_Pagamento'] || transacao['Método'] || transacao['Metodo'] || transacao['Forma_Pagamento'] || '').toUpperCase();
                        if(m.includes('PIX')) window.caixaGlobal.pixReais += valor;
                        if(m.includes('DINHEIRO') || m.includes('ESPECIE') || m.includes('MISTO')) window.caixaGlobal.dinReais += valor;
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
        let cartelas = qtdVendidos >= 5 ? 1 + Math.floor((qtdVendidos - 5) / 5) : 0;
        return { fone, cartelas };
    }

    window.iniciarCorteFoto = function(event) {
        const input = event.target;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgToCrop = document.getElementById('imagemParaCorte'); imgToCrop.src = e.target.result;
                window.modoEdicaoFoto = false; window.tipoCadastroFoto = 'aluno'; abrirModal('modalCorteFoto');
                if(cropperInstancia) cropperInstancia.destroy();
                cropperInstancia = new Cropper(imgToCrop, { aspectRatio: 1, viewMode: 1 });
            }
            reader.readAsDataURL(input.files[0]);
        }
        input.value = ''; 
    }

    window.iniciarCorteColaborador = function(event) {
        const input = event.target;
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgToCrop = document.getElementById('imagemParaCorte'); imgToCrop.src = e.target.result;
                window.modoEdicaoFoto = false; window.tipoCadastroFoto = 'colaborador'; abrirModal('modalCorteFoto');
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
                const imgToCrop = document.getElementById('imagemParaCorte'); imgToCrop.src = e.target.result;
                window.modoEdicaoFoto = true; abrirModal('modalCorteFoto');
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
                    btnConfirmarCorte.innerText = "Enviando para a Nuvem..."; btnConfirmarCorte.disabled = true;
                    cropperInstancia.getCroppedCanvas({ width: 300, height: 300 }).toBlob((blob) => {
                        const formData = new FormData(); 
                        formData.append('file', blob); 
                        formData.append('upload_preset', CLOUDINARY_PRESET);

                        fetch(CLOUDINARY_URL, { method: 'POST', body: formData })
                        .then(r => r.json()).then(dataImg => {
                            if(dataImg.secure_url) {
                                const urlDaFoto = dataImg.secure_url;
                                const pessoa = (window.tipoPessoaEmFoco === 'Parceiro') ? window.todosParceirosBD[window.alunoEmFocoIdx] : window.todosEducandosBD[window.alunoEmFocoIdx];
                                pessoa.foto = urlDaFoto;
                                document.getElementById('detalheFoto').src = urlDaFoto;
                                
                                if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
                                if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
                                
                                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atualizar_foto', nomeAluno: pessoa.nome, fotoUrl: urlDaFoto }) });
                                
                                fecharModal('modalCorteFoto'); window.abrirModalSucesso("Foto updated!");
                            } else { window.abrirModalErro("Erro do Cloudinary."); }
                        }).catch(() => { window.abrirModalErro("Erro de rede."); })
                        .finally(() => { btnConfirmarCorte.innerText = "Cortar e Salvar Foto"; btnConfirmarCorte.disabled = false; window.modoEdicaoFoto = false; });
                    }, 'image/jpeg');
                } else {
                    cropperInstancia.getCroppedCanvas({ width: 300, height: 300 }).toBlob((blob) => {
                        window.fotoFileGlobal = blob;
                        if(window.tipoCadastroFoto === 'colaborador') {
                            document.getElementById('previewFotoColaborador').src = URL.createObjectURL(blob);
                            document.getElementById('previewFotoColaborador').style.display = 'block';
                            document.getElementById('iconCameraColaborador').style.display = 'none';
                        } else {
                            if(document.getElementById('previewFoto')) {
                                document.getElementById('previewFoto').src = URL.createObjectURL(blob);
                                document.getElementById('previewFoto').style.display = 'block';
                                document.getElementById('iconCamera').style.display = 'none';
                            }
                        }
                        fecharModal('modalCorteFoto');
                    }, 'image/jpeg');
                }
            }
        });
    }

    window.renderRankingAlunosAdm = function() {
        const tabela = document.getElementById("tabelaRankingAlunosADM"); if(!tabela) return;
        let filtrados = [...window.todosEducandosBD].filter(a => a.turma !== 'Equipe').sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
        filtrados = filtrados.filter(a => a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0);
        if (window.pages.rankAdm.term) filtrados = filtrados.filter(a => a.nome.toLowerCase().includes(window.pages.rankAdm.term.toLowerCase()));

        const startIdx = (window.pages.rankAdm.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);
        
        tabela.innerHTML = paginated.map((aluno, index) => {
            const posReal = startIdx + index + 1;
            const rec = calcularRecompensas(aluno.lotesVendidos.length);
            const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas}</div>` : '-';
            const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
            const tagMeu = `<br><small style="color:#a0a0a0">Edu: ${aluno.educadorResponsavel}</small>`;
            return `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)}, 'Educando')"><td class="td-center" style="font-weight: bold;">${posReal}º</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong style="color:var(--obsidian);">${aluno.nome}</strong>${tagMeu}</td><td style="color:var(--dim-grey);">${aluno.turma}</td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
        }).join('') || '<tr><td colspan="9" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno encontrado.</td></tr>';
        
        renderPaginationUI('pagRankingAlunos', 'rankAdm', filtrados.length, 10, 'renderRankingAlunosAdm');
    }

    window.renderRankingAlunosEdu = function() {
        const tabela = document.getElementById("tabelaRankingEducador"); if(!tabela) return;
        let filtrados = [...window.todosEducandosBD].filter(a => a.turma !== 'Equipe').sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
        filtrados = filtrados.filter(a => a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0);
        if (window.pages.rankEdu.term) filtrados = filtrados.filter(a => a.nome.toLowerCase().includes(window.pages.rankEdu.term.toLowerCase()));

        const startIdx = (window.pages.rankEdu.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);
        
        tabela.innerHTML = paginated.map((aluno, index) => {
            const posReal = startIdx + index + 1;
            const rec = calcularRecompensas(aluno.lotesVendidos.length);
            const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas}</div>` : '-';
            const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
            const destaque = textoIgual(aluno.educadorResponsavel, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
            const tagMeu = textoIgual(aluno.educadorResponsavel, userName) ? ' <br><span style="font-size:0.7rem; background:var(--petal-pink); color:white; padding:2px 4px; border-radius:4px;">Seu Aluno</span>' : '';
            return `<tr style="${destaque}" onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)}, 'Educando')"><td class="td-center" style="font-weight: bold;">${posReal}º</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong style="color:var(--obsidian);">${aluno.nome}</strong>${tagMeu}</td><td style="color:var(--dim-grey);">${aluno.turma}</td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
        }).join('') || '<tr><td colspan="9" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno encontrado.</td></tr>';
        
        renderPaginationUI('pagRankingEducador', 'rankEdu', filtrados.length, 10, 'renderRankingAlunosEdu');
    }

    window.renderRankingEquipeAdm = function() {
        const tabela = document.getElementById("tabelaRankingEquipeADM"); if(!tabela) return;
        let filtrados = window.todosEducandosBD.filter(a => a.turma === 'Equipe').sort((a, b) => b.lotesVendidos.length - a.lotesVendidos.length);
        
        const startIdx = (window.pages.rankEquipe.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map((colab, index) => {
            const valorArrecadado = (colab.lotesVendidos.length * 20).toFixed(2).replace('.', ',');
            return `<tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(colab)}, 'Equipe')">
                <td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${startIdx + index + 1}º</td>
                <td><img src="${colab.foto}" class="table-avatar" style="border: 2px solid var(--sunflower-gold);"></td>
                <td><strong>${colab.nome}</strong><br><small style="color:var(--sunflower-gold); font-weight:bold;">Colaborador</small></td>
                <td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${colab.lotesVendidos.length}</td>
                <td class="td-center highlight-purple" style="font-weight: bold;">R$ ${valorArrecadado}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum colaborador registrado.</td></tr>';
        
        renderPaginationUI('pagRankingEquipe', 'rankEquipe', filtrados.length, 10, 'renderRankingEquipeAdm');
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
            let descCategoria = pessoa.tipo === 'Equipe' ? 'Venda Direta' : (pessoa.tipo === 'Parceiro' ? 'Parceiro' : `Educando (${pessoa.turma})`);
            return `<tr style="cursor: pointer;" onclick="abrirDetalhesAluno(${pessoa.bdIdx}, '${pessoa.tipo}')">
                <td><img src="${pessoa.foto}" class="table-avatar" style="border: 2px solid ${corBadge};"></td>
                <td><strong>${pessoa.nome}</strong><br><small style="color:${corBadge}; font-weight:bold;">${pessoa.tipo}</small></td>
                <td style="color:var(--dim-grey);">${pessoa.curso || '-'}<br><small style="color:var(--light-grey);">${descCategoria}</small></td>
                <td class="td-center highlight-yellow" style="font-weight:bold; font-size:1.1rem;">${pessoa.lotesPendentes.length}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="4" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhum lote pendente.</td></tr>`;
        
        renderPaginationUI('pagLotes', 'gestaoLotes', filtrados.length, 10, 'renderGestaoLotesPaginado');
    }

    window.renderLogsPaginado = function() {
        const tabela = document.getElementById('tabelaLogs'); if(!tabela) return;
        const filtrados = [...window.logsDoSistema].reverse(); 
        const startIdx = (window.pages.logs.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map(l => {
            const dt = l['Data/Hora'] || l['Data_Hora'] || l['Data Hora'] || l['Data'] || '-';
            const resp = l['Responsavel'] || l['Responsável'] || l['Usuário'] || l['Usuario'] || '-';
            const sessao = l['Sessão_Dispositivo'] || l['Sessao'] || l['Sessao Dispositivo'] || '-';
            const acao = l['Ação_Registrada'] || l['Ação'] || l['Ação'] || l['Acao Registrada'] || '-';
            const det = l['Detalhes'] || l['Detalhe'] || '-';
            return `<tr><td style="color:var(--dim-grey); font-size:0.85rem;">${dt}</td><td><strong>${resp}</strong><br><small style="color:#ccc;">${sessao}</small></td><td style="color:var(--petal-pink); font-weight:bold;">${acao}</td><td style="color:var(--dim-grey);">${det}</td></tr>`;
        }).join('') || `<tr><td colspan="4" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhum log encontrado.</td></tr>`;
        renderPaginationUI('pagLogs', 'logs', filtrados.length, 10, 'renderLogsPaginado');
    }

    window.renderLivroCaixaPaginado = function() {
        const tabela = document.getElementById('tabelaLivroCaixa'); if(!tabela) return;
        const filtrados = window.caixaGlobalBD ? [...window.caixaGlobalBD].reverse() : [];
        const startIdx = (window.pages.caixa.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map(tx => {
            const dt = tx['Data/Hora'] || tx['Data_Hora'] || tx['Data'] || '-';
            const id = tx['ID_Transacao'] || tx['ID'] || '-';
            const lote = tx['Lote'] || tx['Codigo_Lote'] || '-';
            const edu = tx['Educando'] || tx['Aluno'] || '-';
            const val = parseFloat(tx['Valor'] || 0).toFixed(2).replace('.', ',');
            const met = tx['Metodo_Pagamento'] || tx['Método'] || tx['Metodo'] || '-';
            const resp = tx['Responsavel'] || tx['Educador Responsável'] || '-';
            return `<tr><td>${dt}</td><td><span style="color:#a0a0a0; font-size:0.8rem;">${id}</span></td><td><strong>${lote}</strong></td><td>${edu}</td><td class="highlight-purple" style="font-weight:bold;">R$ ${val}</td><td>${met}</td><td>${resp}</td></tr>`;
        }).join('') || `<tr><td colspan="7" class="text-center" style="padding: 2rem; color: #a0a0a0;">Nenhuma transação.</td></tr>`;
        renderPaginationUI('pagLivroCaixa', 'caixa', filtrados.length, 10, 'renderLivroCaixaPaginado');
    }

    window.renderMinhaTurmaPaginado = function() {
        const tabela = document.getElementById('tabelaAlunos'); if(!tabela) return;
        let filtrados = window.todosEducandosBD.filter(a => textoIgual(a.educadorResponsavel, userName) && (a.cadastroAtivo.toLowerCase() === 'sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0)); 
        
        if(window.pages.minhaTurma.term) filtrados = filtrados.filter(a => a.nome.toLowerCase().includes(window.pages.minhaTurma.term.toLowerCase()));
        if(window.pages.minhaTurma.turma !== "Todas") filtrados = filtrados.filter(a => a.turma === window.pages.minhaTurma.turma);

        const startIdx = (window.pages.minhaTurma.current - 1) * 10;
        const paginated = filtrados.slice(startIdx, startIdx + 10);

        tabela.innerHTML = paginated.map((aluno, index) => {
            const posReal = startIdx + index + 1;
            const rec = calcularRecompensas(aluno.lotesVendidos.length);
            const cartelasHTML = rec.cartelas > 0 ? `<div class="flex-center" style="font-weight:bold; color:var(--sunflower-gold);">${rec.cartelas}</div>` : '-';
            const foneHTML = rec.fone > 0 ? '<span class="material-symbols-outlined" style="color:var(--petal-pink);">headphones</span>' : '-';
            return `<tr onclick="abrirDetalhesAluno(${window.todosEducandosBD.indexOf(aluno)}, 'Educando')"><td class="td-center" style="font-weight: bold; color: #BC68A1;">${posReal}</td><td><img src="${aluno.foto}" class="table-avatar"></td><td><strong>${aluno.nome}</strong><br><small style="color:#a0a0a0">${aluno.curso}</small></td><td class="td-center">${aluno.lotesVendidos.length + aluno.lotesPendentes.length}</td><td class="td-center highlight-purple" style="font-weight:bold;">${aluno.lotesVendidos.length}</td><td class="td-center ${aluno.lotesPendentes.length > 0 ? 'td-highlight' : ''}">${aluno.lotesPendentes.length}</td><td class="td-center">${cartelasHTML}</td><td class="td-center">${foneHTML}</td></tr>`;
        }).join('') || '<tr><td colspan="8" class="text-center" style="padding: 20px; color: #a0a0a0;">Nenhum aluno encontrado.</td></tr>';
        
        renderPaginationUI('pagMinhaTurma', 'minhaTurma', filtrados.length, 10, 'renderMinhaTurmaPaginado');
    }

    const srchRankA = document.getElementById("buscaRankingAluno");
    if(srchRankA) srchRankA.addEventListener('input', (e) => { window.pages.rankAdm.term = e.target.value; window.pages.rankAdm.current = 1; window.renderRankingAlunosAdm(); });
    
    const srchLotes = document.getElementById("buscaGestaoLotes");
    if(srchLotes) srchLotes.addEventListener('input', (e) => { window.pages.gestaoLotes.term = e.target.value; window.pages.gestaoLotes.current = 1; window.renderGestaoLotesPaginado(); });

    // ==========================================
    // SEÇÃO DO EDUCADOR (BLINDADA CONTRA CRASHES)
    // ==========================================
    const educadorPage = document.getElementById("educadorPage");
    if (educadorPage) {
        document.getElementById('nomeEducador').innerText = userName;

        const buscaNome = document.getElementById('buscaNomeAluno');
        const filtroTurma = document.getElementById('filtroTurmaAluno');
        if(buscaNome) buscaNome.addEventListener('input', (e) => { window.pages.minhaTurma.term = e.target.value; window.pages.minhaTurma.current = 1; window.atualizarDashboardEducador() });
        if(filtroTurma) filtroTurma.addEventListener('change', (e) => { window.pages.minhaTurma.turma = e.target.value; window.pages.minhaTurma.current = 1; window.atualizarDashboardEducador() });

        window.atualizarDashboardEducador = function() {
            window.renderMinhaTurmaPaginado();

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
            
            const ctxEstEdu = document.getElementById('estoqueChartEdu');
            if (ctxEstEdu && ctxEstEdu.offsetParent !== null) { 
                if (!estoqueChartInstEdu) estoqueChartInstEdu = new Chart(ctxEstEdu.getContext('2d'), { type: 'doughnut', data: { labels: ['Válidos', 'Pendentes', 'Estoque'], datasets: [{ data: [totalVendidosGeral, totalPendentesGeral, 440], backgroundColor: ['#BC68A1', '#F4B841', '#e0e0e0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } });
                else { estoqueChartInstEdu.data.datasets[0].data = [totalVendidosGeral, totalPendentesGeral, 440]; estoqueChartInstEdu.update(); }
            }
            const ctxFinEdu = document.getElementById('financeiroChartEdu');
            if (ctxFinEdu && ctxFinEdu.offsetParent !== null) {
                if (!financeiroChartInstEdu) financeiroChartInstEdu = new Chart(ctxFinEdu.getContext('2d'), { type: 'bar', data: { labels: ['Caixa Realizado', 'Projeção Restante'], datasets: [{ label: 'Valor em R$', data: [vVendas, vPendentes], backgroundColor: ['#BC68A1', '#F4B841'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
                else { financeiroChartInstEdu.data.datasets[0].data = [vVendas, vPendentes]; financeiroChartInstEdu.update(); }
            }

            window.renderRankingAlunosEdu();

            const tabelaRankingEducadores = document.getElementById('tabelaRankingEducadoresLista');
            if(tabelaRankingEducadores) {
                let rankingProf = [...window.mockEducadoresBD].sort((a, b) => b.lotesVendidos - a.lotesVendidos);
                const startIdx = (window.pages.rankProfEdu.current - 1) * 10;
                const paginated = rankingProf.slice(startIdx, startIdx + 10);

                tabelaRankingEducadores.innerHTML = paginated.map((prof, index) => {
                    const destaque = textoIgual(prof.nome, userName) ? 'background-color: rgba(188, 104, 161, 0.05);' : '';
                    const valorArrecadado = (prof.lotesVendidos * 20).toFixed(2).replace('.', ',');
                    return `<tr style="${destaque}"><td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${startIdx + index + 1}º</td><td><strong>${prof.nome}</strong></td><td style="color: var(--dim-grey);">${prof.curso}</td><td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${prof.lotesVendidos}</td><td class="td-center highlight-purple" style="font-weight: bold;">R$ ${valorArrecadado}</td></tr>`;
                }).join('');
                renderPaginationUI('pagRankingEducadoresLista', 'rankProfEdu', rankingProf.length, 10, 'atualizarDashboardEducador');
            }

            let searchBox = `<div style="padding: 10px; position: sticky; top: 0; background: white; border-bottom: 1px solid #eee; z-index: 2;"><input type="text" class="purple-input search-custom-select" placeholder="Pesquisar nome..." style="padding: 0.5rem; font-size: 0.9rem;" onclick="event.stopPropagation()"></div>`;
            const todosMeusAlunosDB = window.todosEducandosBD.filter(a => textoIgual(a.educadorResponsavel, userName));
            
            const selectNomeCadastro = document.getElementById("opcoesNomeEducando");
            const wrapCad = document.getElementById("wrapperNomeEducando");
            if(selectNomeCadastro && wrapCad) {
                let optsCad = searchBox;
                if (todosMeusAlunosDB.length === 0) { optsCad += '<span class="custom-option" data-value="">Nenhum aluno no banco.</span>'; } 
                else {
                    todosMeusAlunosDB.forEach(a => { 
                        let lblFoto = a.foto.includes('ui-avatars') ? '<span style="color:#a0a0a0; font-size: 0.8rem;">(Sem Foto)</span>' : '<span style="color:var(--petal-pink); font-size: 0.8rem;">(Com Foto)</span>';
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
                let alunosAtivosLocal = todosMeusAlunosDB.filter(a => a.cadastroAtivo.toLowerCase() === 'sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0);
                if(alunosAtivosLocal.length === 0) optsAttr += '<span class="custom-option" data-value="">Nenhum aluno ativo.</span>';
                else alunosAtivosLocal.forEach(a => { optsAttr += `<span class="custom-option" data-value="${a.nome}">${a.nome}</span>`; });
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
                        htmlLotes += `<label class="checkbox-item-row" style="opacity: 0.5; cursor: not-allowed;"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}" disabled> <span style="color: var(--dim-grey); font-weight: 500; text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:#a0a0a0;">Em uso</span></label>`; 
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
                btn.innerText = "Enviando para Nuvem..."; btn.disabled = true;

                const nome = document.getElementById("nomeSelectEducando").value;
                const turmaTexto = document.getElementById("turmaSelectEducando").value; 
                if(!nome || !turmaTexto) { btn.disabled = false; btn.innerText = "Ativar Educando"; return window.abrirModalErro("Preencha todos os campos."); }
                let periodo = (turmaTexto === "Turma 3" || turmaTexto === "Turma 4") ? "Tarde" : "Manhã";

                if(window.fotoFileGlobal && window.tipoCadastroFoto === 'aluno') {
                    const formData = new FormData(); 
                    formData.append('file', window.fotoFileGlobal); 
                    formData.append('upload_preset', CLOUDINARY_PRESET);
                    
                    fetch(CLOUDINARY_URL, { method: 'POST', body: formData })
                    .then(r => r.json()).then(dataImg => {
                        if(dataImg.secure_url) { salvarEducandoBanco(nome, turmaTexto, periodo, dataImg.secure_url, btn); } 
                        else { window.abrirModalErro("Falha no Cloudinary"); btn.innerText = "Ativar Educando"; btn.disabled = false; }
                    }).catch(() => { window.abrirModalErro("Erro de rede."); btn.innerText = "Ativar Educando"; btn.disabled = false; });
                } else { salvarEducandoBanco(nome, turmaTexto, periodo, "", btn); }
            });
        }

        function salvarEducandoBanco(nome, turmaTexto, periodo, fotoUrl, btn) {
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'cadastrar_educando', nome: nome, turma: turmaTexto, periodo: periodo, educadorResponsavel: userName, fotoUrl: fotoUrl })
            }).then(res => res.json()).then(data => {
                btn.innerText = "Ativar Educando"; btn.disabled = false;
                if(data.success) {
                    window.registrarLog("Cadastro", `Ativou e vinculou foto ao aluno ${nome}`);
                    fecharModal('modalCadastrarEducando'); formCadastrarEducando.reset();
                    window.fotoFileGlobal = null; document.getElementById('previewFoto').style.display = 'none'; document.getElementById('iconCamera').style.display = 'block';
                    window.abrirModalSucesso(data.message); window.carregarDadosDoBanco();
                } else { window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; window.abrirModalErro("Erro de rede."); });
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
                }).catch(() => { btn.disabled = false; window.abrirModalErro("Erro de rede."); });
            });
        }
    }

    // ==========================================
    // SEÇÃO DO ADMINISTRADOR (BLINDADA CONTRA CRASHES)
    // ==========================================
    const adminPage = document.getElementById("adminPage");
    if (adminPage) {
        
        window.atualizarDashboardsADM = function() {
            const kpiVendasEducandos = document.getElementById('kpiVendasEducandos');
            const kpiVendasEquipe = document.getElementById('kpiVendasEquipe');
            const kpiVendasParceiros = document.getElementById('kpiVendasParceiros');
            const kpiCaixaPix = document.getElementById('kpiCaixaPix');
            const kpiCaixaDinheiro = document.getElementById('kpiCaixaDinheiro');
            const kpiVendasReaisGlobal = document.getElementById('kpiVendasReaisGlobal');
            const kpiProjecaoGlobal = document.getElementById('kpiProjecaoGlobal');

            let totalPendentes = 0, totalVendidos = 0; let ativos = 0; let inativos = 0; 
            let alunosNormais = window.todosEducandosBD.filter(a => a.turma !== 'Equipe');
            let totalAlunos = alunosNormais.length;

            window.todosEducandosBD.forEach(a => { 
                totalPendentes += a.lotesPendentes.length; totalVendidos += a.lotesVendidos.length; 
                if(a.turma !== 'Equipe') {
                    if(a.cadastroAtivo === 'Sim' || a.lotesVendidos.length > 0 || a.lotesPendentes.length > 0) ativos++; else inativos++;
                }
            });

            let vEdu = 0, vEquipe = 0, vParc = 0;
            window.caixaGlobalBD.forEach(tx => {
                let val = parseFloat(tx['Valor']) || parseFloat(tx['Valor_Total']) || 0;
                let cat = tx['Categoria'] || 'Educando';
                if(cat === 'Equipe') vEquipe += val;
                else if(cat === 'Parceiro') vParc += val;
                else vEdu += val;
            });

            const vVendasPix = window.caixaGlobal.pixReais; const vVendasDin = window.caixaGlobal.dinReais;
            const vVendas = vVendasPix + vVendasDin; const vPendentes = totalPendentes * 20.00;

            if(kpiVendasEducandos) kpiVendasEducandos.innerText = `R$ ${vEdu.toFixed(2).replace('.', ',')}`;
            if(kpiVendasEquipe) kpiVendasEquipe.innerText = `R$ ${vEquipe.toFixed(2).replace('.', ',')}`;
            if(kpiVendasParceiros) kpiVendasParceiros.innerText = `R$ ${vParc.toFixed(2).replace('.', ',')}`;
            if(kpiVendasReaisGlobal) kpiVendasReaisGlobal.innerText = `R$ ${vVendas.toFixed(2).replace('.', ',')}`;
            if(kpiCaixaPix) kpiCaixaPix.innerText = `R$ ${vVendasPix.toFixed(2).replace('.', ',')}`;
            if(kpiCaixaDinheiro) kpiCaixaDinheiro.innerText = `R$ ${vVendasDin.toFixed(2).replace('.', ',')}`;
            if(kpiProjecaoGlobal) kpiProjecaoGlobal.innerText = `R$ ${vPendentes.toFixed(2).replace('.', ',')}`;
            
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

            window.renderRankingAlunosAdm();
            window.renderGestaoLotesPaginado();
            window.renderLogsPaginado();
            window.renderLivroCaixaPaginado();
            window.renderRankingEquipeAdm();

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
                    const valorArrecadado = (prof.lotesVendidos * 20).toFixed(2).replace('.', ',');
                    return `<tr><td class="td-center" style="font-weight: bold; color: var(--petal-pink);">${startIdx + index + 1}º</td><td><strong>${prof.nome}</strong></td><td style="color: var(--dim-grey);">${prof.curso}</td><td class="td-center" style="font-weight: bold; font-size: 1.1rem;">${prof.lotesVendidos}</td><td class="td-center highlight-purple" style="font-weight: bold;">R$ ${valorArrecadado}</td></tr>`;
                }).join('');
                renderPaginationUI('pagRankingEducadores', 'rankProfAdm', rankingProf.length, 10, 'atualizarDashboardsADM');
            }

            let searchBox = `<div style="padding: 10px; position: sticky; top: 0; background: white; border-bottom: 1px solid #eee; z-index: 2;"><input type="text" class="purple-input search-custom-select" placeholder="Pesquisar..." style="padding: 0.5rem; font-size: 0.9rem;" onclick="event.stopPropagation()"></div>`;
            const listaSede = document.getElementById("listaLotesSede");
            if(listaSede) {
                let htmlSede = '';
                let lotesEmUso = [];
                window.todosEducandosBD.forEach(a => { lotesEmUso.push(...a.lotesPendentes); lotesEmUso.push(...a.lotesVendidos); });
                window.todosParceirosBD.forEach(p => { lotesEmUso.push(...p.lotesPendentes); lotesEmUso.push(...p.lotesVendidos); });

                window.lotesSedeBD.forEach(l => {
                    const respInfo = l.educador ? ` (Com ${l.educador})` : ' (Na Sede)';
                    if(lotesEmUso.includes(l.codigo)) {
                        htmlSede += `<label class="checkbox-item-row" style="opacity: 0.5; cursor: not-allowed;"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}" disabled> <span style="color: var(--dim-grey); font-weight: 500; text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:#a0a0a0;">Em uso</span></label>`;
                    } else {
                        htmlSede += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span style="color: var(--dim-grey); font-weight: 500;">${l.codigo}</span> <span style="margin-left:auto; font-size: 0.8rem; color:var(--petal-pink);">${respInfo}</span></label>`;
                    }
                });
                listaSede.innerHTML = htmlSede || '<div style="padding: 15px; color:#a0a0a0; text-align:center;">Nenhum lote na base.</div>';
            }

            const listaLotesParceiros = document.getElementById("listaLotesParceirosCheckboxes");
            if(listaLotesParceiros) {
                let htmlLotes = '';
                let lotesEmUso = [];
                window.todosParceirosBD.forEach(p => { lotesEmUso.push(...p.lotesPendentes); lotesEmUso.push(...p.lotesVendidos); });
                window.todosEducandosBD.forEach(a => { lotesEmUso.push(...a.lotesPendentes); lotesEmUso.push(...a.lotesVendidos); });
                const lotesFiltrados = window.lotesSedeBD.filter(l => l.codigo.toUpperCase().includes('PARC'));
                lotesFiltrados.forEach(l => {
                    if(lotesEmUso.includes(l.codigo)) {
                        htmlLotes += `<label class="checkbox-item-row" style="opacity: 0.5;"><input type="checkbox" class="roxo-checkbox" disabled> <span style="text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size:0.8rem; color:#a0a0a0;">Em uso</span></label>`;
                    } else {
                        htmlLotes += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span>${l.codigo}</span></label>`;
                    }
                });
                listaLotesParceiros.innerHTML = htmlLotes || '<div style="padding:15px; text-align:center; color:#a0a0a0;">Nenhum lote PARC vago.</div>';
            }

            const selectParceiroAttr = document.getElementById("opcoesParceiroAtribuir");
            const wrapParcAttr = document.getElementById("wrapperParceiroAtribuir");
            if(selectParceiroAttr && wrapParcAttr) {
                let opts = searchBox;
                if(window.todosParceirosBD.length === 0) opts += '<span class="custom-option" data-value="">Nenhum parceiro.</span>';
                else window.todosParceirosBD.forEach(p => { opts += `<span class="custom-option" data-value="${p.nome}">${p.nome}</span>`; });
                selectParceiroAttr.innerHTML = opts;
                ativarEventosSelectCustomizado(wrapParcAttr);
            }

            const listaLotesEquipe = document.getElementById("listaLotesEquipeCheckboxes");
            if(listaLotesEquipe) {
                let htmlLotesEquipe = '';
                let lotesEmUsoEquipe = [];
                window.todosEducandosBD.forEach(a => { lotesEmUsoEquipe.push(...a.lotesPendentes); lotesEmUsoEquipe.push(...a.lotesVendidos); });
                window.todosParceirosBD.forEach(p => { lotesEmUsoEquipe.push(...p.lotesPendentes); lotesEmUsoEquipe.push(...p.lotesVendidos); });

                const lotesEquipeFiltrados = window.lotesSedeBD.filter(l => l.codigo.toUpperCase().includes('EQU'));
                lotesEquipeFiltrados.forEach(l => {
                    if(lotesEmUsoEquipe.includes(l.codigo)) {
                        htmlLotesEquipe += `<label class="checkbox-item-row" style="opacity: 0.5;"><input type="checkbox" class="roxo-checkbox" disabled> <span style="text-decoration: line-through;">${l.codigo}</span> <span style="margin-left:auto; font-size:0.8rem; color:#a0a0a0;">Em uso</span></label>`;
                    } else {
                        htmlLotesEquipe += `<label class="checkbox-item-row"><input type="checkbox" class="roxo-checkbox" value="${l.codigo}"> <span>${l.codigo}</span></label>`;
                    }
                });
                listaLotesEquipe.innerHTML = htmlLotesEquipe || '<div style="padding:15px; text-align:center; color:#a0a0a0;">Nenhum lote EQU vago.</div>';
            }

            const selectEquipeAttr = document.getElementById("opcoesEquipeAtribuir");
            const wrapEquipeAttr = document.getElementById("wrapperEquipeAtribuir");
            if(selectEquipeAttr && wrapEquipeAttr) {
                let optsEquipe = searchBox;
                let equipeDB = window.todosEducandosBD.filter(a => a.turma === 'Equipe');
                if(equipeDB.length === 0) optsEquipe += '<span class="custom-option" data-value="">Nenhum colaborador.</span>';
                else equipeDB.forEach(c => { optsEquipe += `<span class="custom-option" data-value="${c.nome}">${c.nome}</span>`; });
                selectEquipeAttr.innerHTML = optsEquipe;
                ativarEventosSelectCustomizado(wrapEquipeAttr);
            }

            const opcoesEducador = document.getElementById("opcoesEducadorDestino");
            const wrapEdu = document.getElementById("wrapperEducadorDestino");
            if(opcoesEducador && wrapEdu) {
                let optsEdu = searchBox;
                optsEdu += '<span class="custom-option" data-value="Sede">Devolver para Sede</span>';
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

                window.registrarLog("Transferência (Sede)", `Moveu lotes ${lotesSel.join(', ')} para o destino: ${dest}`);
                lotesSel.forEach(cod => { let l = window.lotesSedeBD.find(x => x.codigo === cod); if(l) l.educador = (dest === 'Sede' ? '' : dest); });
                
                fecharModal('modalTransferirLote'); window.abrirModalSucesso("Transferência realizada!");
                window.atualizarDashboardsADM(); formTransferirLote.reset();

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'transferir_lotes', lotes: lotesSel, educadorDestino: dest === 'Sede' ? '' : dest }) })
                .then(() => { btn.innerText = "Confirmar Transferência"; btn.disabled = false; })
                .catch(err => { console.error(err); btn.disabled = false; });
            });
        }
        
        const formCadastrarParceiro = document.getElementById("formCadastrarParceiro");
        if(formCadastrarParceiro) {
            formCadastrarParceiro.addEventListener("submit", (e) => {
                e.preventDefault();
                const btn = formCadastrarParceiro.querySelector("button[type='submit']");
                btn.innerText = "Salvando..."; btn.disabled = true;
                const nome = document.getElementById("nomeParceiroInput").value;
                
                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'cadastrar_parceiro', nome, cartela: "" })
                }).then(res => res.json()).then(data => {
                    btn.innerText = "Salvar Parceiro"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Cadastro Parceiro", `Cadastrou parceiro comercial ${nome}`);
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

                if(!nomeInput || lotesArray.length === 0) return window.abrirModalErro("Selecione o parceiro e marque pelo menos um lote PARC.");
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
                }).catch(() => { btn.disabled = false; btn.innerText = "Confirmar Atribuição"; });
            });
        }

        const formCadastrarColaborador = document.getElementById("formCadastrarColaborador");
        if(formCadastrarColaborador) {
            formCadastrarColaborador.addEventListener("submit", (e) => {
                e.preventDefault();
                const btn = formCadastrarColaborador.querySelector("button[type='submit']");
                btn.innerText = "Enviando para Nuvem..."; btn.disabled = true;
                const nome = document.getElementById("nomeColaboradorInput").value;

                if(window.fotoFileGlobal && window.tipoCadastroFoto === 'colaborador') {
                    const formData = new FormData(); 
                    formData.append('file', window.fotoFileGlobal); 
                    formData.append('upload_preset', CLOUDINARY_PRESET);
                    
                    fetch(CLOUDINARY_URL, { method: 'POST', body: formData })
                    .then(r => r.json()).then(dataImg => {
                        if(dataImg.secure_url) { salvarColaboradorBanco(nome, dataImg.secure_url, btn); } 
                        else { window.abrirModalErro("Falha na imagem"); btn.innerText = "Salvar Colaborador"; btn.disabled = false; }
                    }).catch(() => { window.abrirModalErro("Erro de rede."); btn.innerText = "Salvar Colaborador"; btn.disabled = false; });
                } else { salvarColaboradorBanco(nome, "", btn); }
            });
        }

        function salvarColaboradorBanco(nome, fotoUrl, btn) {
            fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'cadastrar_colaborador_vendedor', nome: nome, cargo: 'Colaborador', fotoUrl: fotoUrl })
            }).then(res => res.json()).then(data => {
                btn.innerText = "Salvar Colaborador"; btn.disabled = false;
                if(data.success) {
                    window.registrarLog("Cadastro Colaborador", `Cadastrou o colaborador de vendas diretas ${nome}`);
                    fecharModal('modalCadastrarColaborador'); formCadastrarColaborador.reset();
                    window.fotoFileGlobal = null; 
                    document.getElementById('previewFotoColaborador').style.display = 'none'; 
                    document.getElementById('iconCameraColaborador').style.display = 'block';
                    window.abrirModalSucesso(data.message); window.carregarDadosDoBanco();
                } else { window.abrirModalErro(data.message); }
            }).catch(() => { btn.disabled = false; window.abrirModalErro("Erro de rede."); });
        }

        const formAtribuirLoteEquipe = document.getElementById("formAtribuirLoteEquipe");
        if(formAtribuirLoteEquipe) {
            formAtribuirLoteEquipe.addEventListener("submit", (e) => {
                e.preventDefault();
                const nomeInput = document.getElementById("equipeAtribuirSelect").value;
                const checkboxesMarcados = document.querySelectorAll('#listaLotesEquipeCheckboxes input[type="checkbox"]:checked');
                const lotesArray = Array.from(checkboxesMarcados).map(cb => cb.value);

                if(!nomeInput || lotesArray.length === 0) return window.abrirModalErro("Selecione o colaborador e marque pelo menos um lote EQU.");
                const btn = formAtribuirLoteEquipe.querySelector("button[type='submit']");
                btn.innerText = "Atribuindo..."; btn.disabled = true;

                fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'atribuir_lote', nomeAluno: nomeInput, lotes: lotesArray }) })
                .then(res => res.json()).then(data => {
                    btn.innerText = "Confirmar Atribuição"; btn.disabled = false;
                    if(data.success) {
                        window.registrarLog("Atribuição Equipe", `Atribuiu lotes ${lotesArray.join(', ')} para o colaborador ${nomeInput}`);
                        fecharModal('modalAtribuirLoteEquipe'); formAtribuirLoteEquipe.reset(); 
                        window.abrirModalSucesso("Lotes EQU atribuídos com sucesso!"); window.carregarDadosDoBanco(); 
                    } else window.abrirModalErro(data.message);
                }).catch(() => { btn.disabled = false; window.abrirModalErro("Erro de rede."); });
            });
        }
    }

    // ==========================================
    // MODAIS E TRANSAÇÕES GLOBAIS
    // ==========================================
    window.abrirModal = function(id) { document.getElementById(id).classList.add('active'); }
    window.fecharModal = function(id) { document.getElementById(id).classList.remove('active'); }
    window.abrirModalSucesso = function(txt) { document.getElementById('textoModalSucesso').innerText = txt; abrirModal('modalSucesso'); }
    window.abrirModalErro = function(txt) { const pErro = document.getElementById('textoModalErro'); if(pErro) pErro.innerText = txt; abrirModal('modalErro'); }
    window.toggleMisto = function(mostrar) { document.getElementById('camposMisto').style.display = mostrar ? 'flex' : 'none'; }

    window.abrirDetalhesAluno = function(idx, tipo = 'Educando') {
        window.alunoEmFocoIdx = idx; 
        window.tipoPessoaEmFoco = tipo;
        const isAdmin = document.getElementById('adminPage') !== null;
        
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx]; 
        
        const elFoto = document.getElementById('detalheFoto'); if(elFoto) elFoto.src = pessoa.foto;
        const elNome = document.getElementById('detalheNome'); if(elNome) elNome.innerText = pessoa.nome;
        
        const elTurma = document.getElementById('detalheTurma'); 
        if(elTurma) {
            if (tipo === 'Parceiro') elTurma.innerText = `Comércio - Parceiro`;
            else if (pessoa.turma === 'Equipe') elTurma.innerText = `Vendas Diretas - Equipe`;
            else elTurma.innerText = `${pessoa.curso} - ${pessoa.turma}`;
        }
        
        const recompensas = calcularRecompensas(pessoa.lotesVendidos.length);
        const elFone = document.getElementById('detalheFone'); if(elFone) elFone.innerText = recompensas.fone;
        const elCartelas = document.getElementById('detalheCartelasGanhas'); if(elCartelas) elCartelas.innerText = recompensas.cartelas;
        
        let pendentesEntrega = recompensas.cartelas - (pessoa.cartelasEntregues || 0);
        const boxRetirar = document.getElementById('boxRetirarCartela');
        if (boxRetirar) {
            if (pendentesEntrega > 0 && !isAdmin) { 
                boxRetirar.style.display = 'block';
                document.getElementById('detalheCartelasPendentes').innerText = pendentesEntrega;
                document.getElementById('btnRetirarCartela').onclick = () => window.registrarRetiradaCartela(idx);
            } else { boxRetirar.style.display = 'none'; }
        }

        const elVendidos = document.getElementById('detalheQtdVendidos'); if(elVendidos) elVendidos.innerText = pessoa.lotesVendidos.length;
        const elPendentes = document.getElementById('detalheQtdPendentes'); if(elPendentes) elPendentes.innerText = pessoa.lotesPendentes.length;
        const elDevolvidos = document.getElementById('detalheQtdDevolvidos'); if(elDevolvidos) elDevolvidos.innerText = pessoa.lotesDevolvidos ? pessoa.lotesDevolvidos.length : 0;
        
        const badgeVendidos = pessoa.lotesVendidos.length ? pessoa.lotesVendidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        let badgePendentes = '<span class="badge-lote vazio">Nenhum</span>';
        if(pessoa.lotesPendentes.length) {
            if(isAdmin) {
                const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'block';
                badgePendentes = pessoa.lotesPendentes.map(l => `<span class="badge-lote" style="border: 1px dashed var(--sunflower-gold); cursor:pointer;" title="Gerenciar Lote" onclick="abrirAcaoLote('${l}', ${idx}, '${tipo}'); event.stopPropagation();">${l} ⚙️</span>`).join('');
            } else {
                const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'none';
                badgePendentes = pessoa.lotesPendentes.map(l => `<span class="badge-lote">${l}</span>`).join('');
            }
        } else {
            const cliquePend = document.getElementById('msgCliquePendente'); if(cliquePend) cliquePend.style.display = 'none';
        }
        
        const badgeDevolvidos = pessoa.lotesDevolvidos && pessoa.lotesDevolvidos.length ? pessoa.lotesDevolvidos.map(l => `<span class="badge-lote">${l}</span>`).join('') : '<span class="badge-lote vazio">Nenhum</span>';
        
        const bV = document.getElementById('detalheBadgesVendidos'); if(bV) bV.innerHTML = badgeVendidos;
        const bP = document.getElementById('detalheBadgesPendentes'); if(bP) bP.innerHTML = badgePendentes;
        const bD = document.getElementById('detalheBadgesDevolvidos'); if(bD) bD.innerHTML = badgeDevolvidos;
        
        abrirModal('modalDetalhesAluno');
    }

    window.abrirAcaoLote = function(lote, idxAluno, tipo = 'Educando') {
        if(window.lotesValidadosNestaSessao.has(lote)) {
            return window.abrirModalErro("Esse Lote já está faturado ou processado!");
        }
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idxAluno] : window.todosEducandosBD[idxAluno];
        document.getElementById('acaoLoteNome').innerText = lote;
        document.getElementById('acaoLoteAluno').innerText = pessoa.nome;
        document.getElementById('acaoLoteInput').value = lote;
        document.getElementById('acaoAlunoIdxInput').value = idxAluno;
        document.getElementById('modalAcaoLote').setAttribute('data-tipo', tipo);
        
        const radioPix = document.querySelector('input[name="formaPagamentoLote"][value="PIX"]');
        if(radioPix) radioPix.checked = true;
        window.toggleMisto(false); document.getElementById('valorPixMisto').value = ''; document.getElementById('valorDinMisto').value = '';

        fecharModal('modalDetalhesAluno'); abrirModal('modalAcaoLote');
    }

    window.confirmarVendaLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const tipo = document.getElementById('modalAcaoLote').getAttribute('data-tipo') || 'Educando';
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx];
        const formaPagamento = document.querySelector('input[name="formaPagamentoLote"]:checked').value;
        let vPix = 0, vDin = 0;

        if (formaPagamento === "PIX") { vPix = 20.00; } 
        else if (formaPagamento === "Dinheiro") { vDin = 20.00; } 
        else {
            vPix = parseFloat(document.getElementById('valorPixMisto').value) || 0;
            vDin = parseFloat(document.getElementById('valorDinMisto').value) || 0;
            if (vPix + vDin !== 20.00) return window.abrirModalErro(`A soma deve dar R$ 20,00.`);
        }

        if(window.lotesValidadosNestaSessao.has(lote)) {
            fecharModal('modalAcaoLote');
            return window.abrirModalErro("Você já faturou este lote. Aguarde a sincronização.");
        }
        window.lotesValidadosNestaSessao.add(lote); 
        
        window.caixaGlobal.pixReais += vPix; window.caixaGlobal.dinReais += vDin;
        pessoa.lotesPendentes = pessoa.lotesPendentes.filter(l => l !== lote);
        pessoa.lotesVendidos.push(lote);
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Venda confirmada!"); 
        window.registrarLog("Validação Venda", `Lote ${lote} validado para ${pessoa.nome} (${tipo}). Pagamento: R$ ${vPix+vDin} via ${formaPagamento}`);
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM(); 
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'venda', lote: lote, nome: pessoa.nome, nomeAluno: pessoa.nome, tipoPessoa: tipo, vPix: vPix, vDin: vDin, responsavel: userName })
        }).catch(err => console.error("Erro", err));
    }

    window.confirmarDevolucaoLote = function() {
        const lote = document.getElementById('acaoLoteInput').value;
        const idx = document.getElementById('acaoAlunoIdxInput').value;
        const tipo = document.getElementById('modalAcaoLote').getAttribute('data-tipo') || 'Educando';
        const pessoa = (tipo === 'Parceiro') ? window.todosParceirosBD[idx] : window.todosEducandosBD[idx];
        
        if(window.lotesValidadosNestaSessao.has(lote)) {
            fecharModal('modalAcaoLote');
            return window.abrirModalErro("Você já processou este lote. Aguarde a sincronização.");
        }
        window.lotesValidadosNestaSessao.add(lote);

        pessoa.lotesPendentes = pessoa.lotesPendentes.filter(l => l !== lote);
        if(!pessoa.lotesDevolvidos) pessoa.lotesDevolvidos = [];
        pessoa.lotesDevolvidos.push(lote);
        
        fecharModal('modalAcaoLote'); window.abrirModalSucesso("Lote devolvido com sucesso!"); 
        window.registrarLog("Devolução Lote", `Lote ${lote} devolvido por ${pessoa.nome} (${tipo})`);
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();

        fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'transacao_lote', acaoLote: 'devolucao', lote: lote, nome: pessoa.nome, nomeAluno: pessoa.nome, tipoPessoa: tipo, responsavel: userName })
        }).catch(err => console.error("Erro", err));
    }

    if (document.getElementById("adminPage") || document.getElementById("educadorPage")) {
        window.carregarDadosDoBanco();
    }
});
