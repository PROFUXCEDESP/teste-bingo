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
        rankEquipe: { current: 1 },
        parceiros: { current: 1 }
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
        window.logsDoSistema.push({ 'Data/Hora': dataHora, 'Responsavel': userName, 'Sessão_Dispositivo': sessao, 'Ação_Registrada': acao, 'Detalhes': detalhe });
        if(document.getElementById('tabelaLogs') && window.renderLogsPaginado) window.renderLogsPaginado();
        
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
                if
