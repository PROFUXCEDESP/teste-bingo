<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CEDESP Bingo - Administração</title>
    <link rel="icon" href="assets/image/logo_cedesp.png" type="image/png">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0" />
    <style>
        .purple-input { width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid #ccc; color: var(--dim-grey); font-size: 1rem; outline: none; transition: all 0.3s ease; }
        .purple-input:focus { border-color: var(--petal-pink) !important; box-shadow: 0 0 0 3px rgba(188, 104, 161, 0.2) !important; }
        .paginacao-container { display: flex; justify-content: center; align-items: center; padding: 15px; gap: 10px; background: #fdfdfd; border-top: 1px solid #eee; border-radius: 0 0 12px 12px; }
        .paginacao-input { width: 45px; padding: 4px; text-align: center; border: 1px solid var(--petal-pink); border-radius: 4px; font-weight: bold; color: var(--petal-pink); }
    </style>
</head>
<body class="dashboard-body" id="adminPage">
    <div class="dashboard-wrapper">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-logo">
                <img src="assets/image/logo_cedesp.png" alt="Logo CEDESP" style="max-width: 150px;">
                <button class="close-sidebar-btn" id="closeSidebar"><span class="material-symbols-outlined">close</span></button>
            </div>
            <ul class="sidebar-nav">
                <li class="nav-item active" id="navVisaoGeral" onclick="mudarAbaEducador('secVisaoGeral', 'navVisaoGeral')"><span class="material-symbols-outlined nav-icon">dashboard</span> <span class="nav-text">Visão Geral</span></li>
                <li class="nav-item" id="navGestaoLotes" onclick="mudarAbaEducador('secGestaoLotes', 'navGestaoLotes')"><span class="material-symbols-outlined nav-icon">inventory_2</span> <span class="nav-text">Gestão de Lotes</span></li>
                <li class="nav-item" id="navRankingAlunos" onclick="mudarAbaEducador('secRankingAlunos', 'navRankingAlunos')"><span class="material-symbols-outlined nav-icon">emoji_events</span> <span class="nav-text">Ranking Educandos</span></li>
                <li class="nav-item" id="navLivroCaixa" onclick="mudarAbaEducador('secLivroCaixa', 'navLivroCaixa')"><span class="material-symbols-outlined nav-icon">account_balance_wallet</span> <span class="nav-text">Livro Caixa</span></li>
            </ul>
        </aside>
        <div class="main-panel">
            <header class="admin-header">
                <div class="header-left"><button class="menu-toggle" id="openSidebar"><span class="material-symbols-outlined">menu</span></button><h1 class="admin-title">Painel Administrativo</h1></div>
            </header>
            <main class="admin-container">
                <section id="secVisaoGeral">
                    <div class="dashboard-grid">
                        <div class="kpi-card"><div class="kpi-title">Arrecadação Global</div><div class="kpi-value highlight-purple" id="kpiVendasReaisGlobal">R$ 0,00</div></div>
                    </div>
                </section>
                <section id="secGestaoLotes" style="display: none;">
                    <h2 class="section-title">Gestão de Lotes</h2>
                    <div style="margin-bottom: 1rem;">
                        <input type="text" id="buscaLoteAdm" class="purple-input" placeholder="Pesquisar aluno ou turma..." oninput="window.atualizarDashboardsADM()">
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead><tr><th>Aluno</th><th>Turma</th><th class="text-center">Pendentes</th><th class="text-center">Ações</th></tr></thead>
                            <tbody id="tabelaGestaoLotes"></tbody>
                        </table>
                    </div>
                </section>
                <section id="secRankingAlunos" style="display: none;">
                    <h2 class="section-title">Ranking Geral</h2>
                    <div class="table-container">
                        <table class="data-table">
                            <thead><tr><th class="text-center">Pos.</th><th>Foto</th><th>Nome</th><th class="text-center">Lotes</th><th class="text-center">Vendidos</th><th class="text-center">Pendentes</th><th class="text-center">Cartelas</th><th class="text-center">Fone</th></tr></thead>
                            <tbody id="tabelaRankingAlunosADM"></tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    </div>
    <script src="js/app.js"></script>
</body>
</html>
