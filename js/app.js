document.addEventListener("DOMContentLoaded", () => {
    
    // --- UTILITÁRIOS ---
    function textoIgual(t1, t2) {
        if(!t1 || !t2) return false;
        return t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === 
               t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWD-pi7qf1Vlp01I8CO-7euJmqsNureruSEjeFc9bdYUZ_M13he6bqBC_ctJGHUpc4ow/exec'; 
    const userName = localStorage.getItem('usuarioLogado') || 'Administrador';
    
    // --- ESTADO GLOBAL ---
    window.todosEducandosBD = [];
    window.caixaGlobalBD = [];
    window.logsBD = [];
    
    // Paginação
    window.paginacao = {
        minhaTurma: 0,
        gestaoLotes: 0,
        rankingGeral: 0,
        livroCaixa: 0,
        logs: 0,
        itensPorPagina: 10
    };
    window.totalItensTelas = {};

    // --- MOTOR DE PAGINAÇÃO ---
    window.gerarControlesPaginacao = function(chave, totalItens) {
        window.totalItensTelas[chave] = totalItens;
        const totalPaginas = Math.ceil(totalItens / window.paginacao.itensPorPagina);
        if (totalPaginas <= 1) return "";
        const pgAtual = window.paginacao[chave] + 1;

        return `
            <div class="paginacao-container" style="display:flex; justify-content:center; align-items:center; gap:10px; padding:15px; border-top:1px solid #eee;">
                <button class="btn-secondary" ${pgAtual === 1 ? 'disabled' : ''} onclick="window.mudarPagina('${chave}', -1)"> < </button>
                <div style="display:flex; align-items:center; gap:5px;">
                    <span>Pág.</span>
                    <input type="number" value="${pgAtual}" min="1" max="${totalPaginas}" 
                           style="width:45px; text-align:center; border:1px solid var(--petal-pink); border-radius:4px;"
                           onchange="window.irParaPagina('${chave}', this.value - 1)">
                    <span>de ${totalPaginas}</span>
                </div>
                <button class="btn-secondary" ${pgAtual >= totalPaginas ? 'disabled' : ''} onclick="window.mudarPagina('${chave}', 1)"> > </button>
            </div>`;
    };

    window.mudarPagina = function(chave, direcao) {
        window.paginacao[chave] += direcao;
        renderizarTabelas();
    };

    window.irParaPagina = function(chave, novaPagina) {
        const totalPaginas = Math.ceil(window.totalItensTelas[chave] / window.paginacao.itensPorPagina);
        if (novaPagina >= 0 && novaPagina < totalPaginas) {
            window.paginacao[chave] = novaPagina;
        } else {
            window.paginacao[chave] = 0;
        }
        renderizarTabelas();
    };

    // --- RENDERIZAÇÃO ---
    function renderizarTabelas() {
        if(document.getElementById("adminPage")) window.atualizarDashboardsADM();
        if(document.getElementById("educadorPage")) window.atualizarDashboardEducador();
    }

    // --- LÓGICA DE RANKING PADRONIZADA ---
    window.gerarLinhaRanking = function(aluno, pos, indexGlobal) {
        // Exemplo simples de cálculo de recompensas (ajuste conforme sua regra)
        const vend = aluno.lotesVendidos?.length || 0;
        const pend = aluno.lotesPendentes?.length || 0;
        const total = vend + pend;
        
        return `
            <tr>
                <td class="td-center">${pos}</td>
                <td><img src="${aluno.foto || 'assets/image/default.png'}" class="table-avatar"></td>
                <td><strong>${aluno.nome}</strong><br><small>${aluno.turma}</small></td>
                <td class="td-center">${total}</td>
                <td class="td-center highlight-purple">${vend}</td>
                <td class="td-center">${pend}</td>
                <td class="td-center">${vend >= 5 ? Math.floor(vend/5) : '-'}</td>
                <td class="td-center">${vend >= 10 ? '🎁' : '-'}</td>
            </tr>`;
    };

    // --- ATUALIZAÇÃO ADMIN ---
    window.atualizarDashboardsADM = function() {
        // Gestão de Lotes com Busca
        const termoLotes = document.getElementById('buscaLotesAdm')?.value.toLowerCase() || "";
        const filtradosLotes = window.todosEducandosBD.filter(a => 
            (a.lotesPendentes?.length > 0) && (a.nome.toLowerCase().includes(termoLotes) || a.turma.toLowerCase().includes(termoLotes))
        );
        
        const tbodyLotes = document.getElementById("tabelaGestaoLotes");
        if(tbodyLotes) {
            const inicio = window.paginacao.gestaoLotes * window.paginacao.itensPorPagina;
            const slice = filtradosLotes.slice(inicio, inicio + window.paginacao.itensPorPagina);
            tbodyLotes.innerHTML = slice.map(aluno => `
                <tr>
                    <td><strong>${aluno.nome}</strong></td>
                    <td>${aluno.turma}</td>
                    <td class="td-center">${aluno.lotesPendentes.length}</td>
                    <td class="td-center"><button class="btn-primary" onclick="abrirAcoes('${aluno.nome}')">Gerenciar</button></td>
                </tr>`).join('');
            
            const cont = tbodyLotes.closest('.table-container');
            if(cont.querySelector('.paginacao-container')) cont.querySelector('.paginacao-container').remove();
            cont.insertAdjacentHTML('beforeend', window.gerarControlesPaginacao('gestaoLotes', filtradosLotes.length));
        }

        // Ranking ADM
        const tbodyRank = document.getElementById("tabelaRankingAlunos");
        if(tbodyRank) {
            const listRank = [...window.todosEducandosBD].sort((a,b) => (b.lotesVendidos?.length || 0) - (a.lotesVendidos?.length || 0));
            const inicio = window.paginacao.rankingGeral * window.paginacao.itensPorPagina;
            tbodyRank.innerHTML = listRank.slice(inicio, inicio + window.paginacao.itensPorPagina)
                                          .map((a, i) => window.gerarLinhaRanking(a, inicio + i + 1)).join('');
            
            const cont = tbodyRank.closest('.table-container');
            if(cont.querySelector('.paginacao-container')) cont.querySelector('.paginacao-container').remove();
            cont.insertAdjacentHTML('beforeend', window.gerarControlesPaginacao('rankingGeral', listRank.length));
        }
    };

    // --- ATUALIZAÇÃO EDUCADOR ---
    window.atualizarDashboardEducador = function() {
        const termoBusca = document.getElementById('buscaNomeAluno')?.value.toLowerCase() || "";
        
        // Minha Turma (Filtro por Professor + Busca)
        const minhaTurma = window.todosEducandosBD.filter(a => 
            textoIgual(a.educadorResponsavel, userName) && a.nome.toLowerCase().includes(termoBusca)
        );

        const tbodyTurma = document.getElementById("tabelaAlunos");
        if(tbodyTurma) {
            const inicio = window.paginacao.minhaTurma * window.paginacao.itensPorPagina;
            tbodyTurma.innerHTML = minhaTurma.slice(inicio, inicio + window.paginacao.itensPorPagina)
                                             .map((a, i) => window.gerarLinhaRanking(a, inicio + i + 1)).join('');
            
            const cont = tbodyTurma.closest('.table-container');
            if(cont.querySelector('.paginacao-container')) cont.querySelector('.paginacao-container').remove();
            cont.insertAdjacentHTML('beforeend', window.gerarControlesPaginacao('minhaTurma', minhaTurma.length));
        }

        // Ranking Geral no Educador (Igual ao ADM)
        const tbodyRankEdu = document.getElementById("tabelaRankingEducador");
        if(tbodyRankEdu) {
            const listRank = [...window.todosEducandosBD].sort((a,b) => (b.lotesVendidos?.length || 0) - (a.lotesVendidos?.length || 0));
            const inicio = window.paginacao.rankingGeral * window.paginacao.itensPorPagina;
            tbodyRankEdu.innerHTML = listRank.slice(inicio, inicio + window.paginacao.itensPorPagina)
                                             .map((a, i) => window.gerarLinhaRanking(a, inicio + i + 1)).join('');
            
            const cont = tbodyRankEdu.closest('.table-container');
            if(cont.querySelector('.paginacao-container')) cont.querySelector('.paginacao-container').remove();
            cont.insertAdjacentHTML('beforeend', window.gerarControlesPaginacao('rankingGeral', listRank.length));
        }
    };

    // --- CARGA INICIAL ---
    window.carregarDados = function() {
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'sincronizar_dados' }) })
            .then(r => r.json()).then(data => {
                if(data.success) {
                    window.todosEducandosBD = data.educandos;
                    renderizarTabelas();
                }
            });
    };

    window.carregarDados();
});
