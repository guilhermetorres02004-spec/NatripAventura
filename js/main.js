// main.js: lógica de interface e autenticação local
// Comentários detalhados seguem para estudo linha-a-linha.
// Resumo das responsabilidades do arquivo:
// 1) Injetar o header com o logo e menu no início do <body>.
// 2) Fazer a animação rotativa do slogan/heading.
// 3) Implementar autenticação simples (signup, login, logout) usando localStorage.
// 4) Expor funções úteis via `window.natripAuth` para outras páginas consumirem.
// 5) Fornecer um menu de perfil (dropdown) com links para páginas do usuário.

document.addEventListener("DOMContentLoaded", () => {
    (async function() {
        // tenta sincronizar usuários do backend para o localStorage (se o backend estiver disponível)
        async function trySyncFromServer() {
            try {
                const resp = await fetch('/api/users', { method: 'GET' });
                if (!resp.ok) return;
                const users = await resp.json();
                if (Array.isArray(users) && users.length > 0) {
                    // persiste localmente para manter compatibilidade com o código existente
                    localStorage.setItem('natrip_users', JSON.stringify(users));
                }
            } catch (e) {
                // backend não disponível — segue com storage local
            }
        }

        await trySyncFromServer().catch(() => {});

    // headerHTML: string com o markup do cabeçalho. É inserida dinamicamente para evitar duplicação
    // entre várias páginas e garantir que o JS possa controlar o estado (ex.: texto do perfil).
    const headerHTML = `
    <header>
        <div class="header-top">
            <div class="logo-area">
                <div class="logo-top">Natrip</div>
                <div class="flag"></div>
            </div>

            <nav class="menu">
                <a href="/index.html">Início</a>
                <a href="/shop.html">Shop</a>
                <a href="/sobre.html">Sobre</a>
                <a href="/contato.html">Contato</a>
                <a href="/admin-notificacoes.html" id="admin-notifications-link" title="Notificações de compras" style="display:none;align-items:center;justify-content:center;font-size:1.2rem;line-height:1;">🔔</a>
                <div class="perfil-menu">
                    <!-- botão que abre o dropdown de perfil -->
                    <button class="perfil-btn">👤 Perfil</button>
                    <!-- container onde o conteúdo do dropdown será inserido dinamicamente -->
                    <div class="perfil-dropdown" id="perfil-dropdown" aria-hidden="true"></div>
                </div>
            </nav>
        </div>

        <div class="header-content">
            <!-- ids "logo" e "slogan" são usados pela animação abaixo -->
            <h1 id="logo">Natrip Aventura</h1>
            <p id="slogan">Viagens inesquecíveis por Minas Gerais</p>
        </div>
    </header>
    `;

    // Inserimos o header no começo do body para que apareça em todas as páginas.
    document.body.insertAdjacentHTML("afterbegin", headerHTML);

    // ===== animação do texto (header) =====
    // Seleciona os elementos que serão animados: o título (`logo`) e o parágrafo (`slogan`).
    const logo = document.getElementById("logo");
    const slogan = document.getElementById("slogan");

    // Se algum dos elementos não existir, interrompe (p.ex.: páginas sem header-injetado corretamente).
    if (!logo || !slogan) return;

    // Lista de frases que serão rotacionadas no slogan.
    const frases = [
        "Viagens inesquecíveis por Minas Gerais, saindo de Belo Horizonte",
        "Roteiros de carro para quem ama estrada e aventura",
        "Descubra cachoeiras, cidades históricas e paisagens únicas",
        "Experiências autênticas pelo coração de Minas Gerais"
    ];

    // índice da frase atual
    let index = 0;

    // A cada 7 segundos aplicamos classes CSS que disparam animações definidas em `style.css`.
    // Uso de `void logo.offsetWidth;` é um truque para forçar reflow e reiniciar a animação.
    setInterval(() => {
        logo.classList.remove("dash");
        void logo.offsetWidth;
        logo.classList.add("dash");

        slogan.classList.remove("fade");
        void slogan.offsetWidth;
        slogan.classList.add("fade");

        // Após o efeito de saída, trocamos o texto do slogan.
        setTimeout(() => {
            index = (index + 1) % frases.length;
            slogan.textContent = frases[index];
        }, 300);
    }, 7000);

    // ===== Simple client-side auth (localStorage) =====
    // NOTA: esta é uma implementação didática/cliente apenas. Em produção, use um backend seguro.
    // Estruturas no localStorage:
    //  - 'natrip_users'  : array de usuários { name, cpf, phone, email, password }
    //  - 'natrip_currentUser' : objeto com dados públicos do usuário logado (sem senha)

    // Retorna array de usuários (ou vazio)
    function getUsers() {
        return JSON.parse(localStorage.getItem('natrip_users') || '[]');
    }

    // Persiste array de usuários (salva localmente e tenta sincronizar com backend)
    function saveUsers(users) {
        localStorage.setItem('natrip_users', JSON.stringify(users));
        try {
            // fire-and-forget: envia lista para o backend para manter sincronização
            fetch('/api/users/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ users })
            }).catch(() => {});
        } catch (e) { /* ignore */ }
    }

    // Nota: a criação de usuário agora deve ser feita pelo backend.
    // O servidor já garante a existência do usuário admin no banco.

    // Define o usuário atual exibido no sistema (salva publicamente em localStorage)
    function setCurrentUser(user) {
        localStorage.setItem('natrip_currentUser', JSON.stringify(user));
    }

    // Retorna o usuário atual ou null
    function getCurrentUser() {
        return JSON.parse(localStorage.getItem('natrip_currentUser') || 'null');
    }

    // Remove o usuário atual (logout)
    function clearCurrentUser() {
        localStorage.removeItem('natrip_currentUser');
    }

    // Expondo helpers para outras páginas usarem (p.ex. perfil-dados.html)
    window.natripAuth = {
        getUsers: getUsers,
        saveUsers: saveUsers,
        setCurrentUser: setCurrentUser,
        getCurrentUser: getCurrentUser,
        clearCurrentUser: clearCurrentUser
    };

    // Reserved dates per user (admin can set dates a user will travel)
    function getUserReservedDates(email) {
        if (!email) return [];
        try { return JSON.parse(localStorage.getItem(`natrip_reserved_dates_${email}`) || '[]'); } catch(e) { return []; }
    }
    function saveUserReservedDates(email, dates) {
        if (!email) return;
        try { localStorage.setItem(`natrip_reserved_dates_${email}`, JSON.stringify(dates || [])); } catch(e) {}
    }

    // expose reservation helpers
    window.natripAuth.getUserReservedDates = getUserReservedDates;
    window.natripAuth.saveUserReservedDates = saveUserReservedDates;

    // admin trips (global trips created by admin)
    function getAdminTrips() { try { return JSON.parse(localStorage.getItem('natrip_admin_trips') || '[]'); } catch(e) { return []; } }
    function saveAdminTrips(arr) { try { localStorage.setItem('natrip_admin_trips', JSON.stringify(arr || [])); } catch(e) {} }
    window.natripAuth.getAdminTrips = getAdminTrips;
    window.natripAuth.saveAdminTrips = saveAdminTrips;

    // Mostra uma mensagem em um elemento identificado por `elId`. `success` controla cor.
    function showMessage(elId, text, success) {
        const el = document.getElementById(elId);
        if (!el) return; // elemento pode não existir em páginas diferentes
        el.textContent = text;
        el.style.color = success ? '#0a7' : '#c33';
    }

    // ===== Signup (criar conta) =====
    // Lê campos do formulário de cadastro, valida CPF/telefone simples, e adiciona usuário
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // coleta valores do formulário
            const name = document.getElementById('signup-name').value.trim();
            const cpf = document.getElementById('signup-cpf').value.trim();
            const phone = document.getElementById('signup-phone').value.trim();
            const email = document.getElementById('signup-email').value.trim().toLowerCase();
            const password = document.getElementById('signup-password').value;
            
            // coleta campo "Como conheceu"
            const sourceSelect = document.getElementById('signup-source');
            const sourceOther = document.getElementById('signup-source-other');
            const referralLinkField = document.getElementById('signup-referral-link');
            let source = sourceSelect ? sourceSelect.value : '';
            let referralCode = '';
            
            // Se selecionou "Outros", usa o valor do campo de texto
            if (source === 'Outros' && sourceOther) {
                source = sourceOther.value.trim();
            }
            
            // Se selecionou "Amigo", extrai o código de convite
            if (source === 'Amigo' && referralLinkField) {
                const referralInput = referralLinkField.value.trim();
                if (referralInput) {
                    // Tenta extrair o código do link (formato: ?ref=XXXXXXXX) ou usa direto se for só o código
                    const match = referralInput.match(/[?&]ref=([A-Z0-9]+)/i);
                    if (match && match[1]) {
                        referralCode = match[1].toUpperCase();
                    } else {
                        // Se não encontrou padrão de link, assume que é o código direto
                        referralCode = referralInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    }
                }
            }

            // validações básicas no cliente (apenas formato)
            const cpfDigits = cpf.replace(/\D/g, ''); // remove não-dígitos
            if (cpfDigits.length !== 11) {
                showMessage('signup-msg', 'CPF inválido. Informe 11 dígitos.', false);
                return;
            }

            const phoneDigits = phone.replace(/\D/g, '');
            if (phoneDigits.length < 10 || phoneDigits.length > 11) {
                showMessage('signup-msg', 'Telefone inválido. Informe 10 ou 11 dígitos.', false);
                return;
            }

            // verifica se já existe usuário com o mesmo e-mail
            const users = getUsers();
            if (users.find(u => u.email === email)) {
                showMessage('signup-msg', 'Já existe uma conta com esse e-mail.', false);
                return;
            }

            // cria novo usuário via backend (sem salvar no localStorage)
            const newUser = { name, cpf: cpfDigits, phone: phoneDigits, email, password, source };
            if (referralCode) {
                newUser.referredBy = referralCode;
            }
            try {
                const resp = await fetch('/api/signup', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newUser)
                });
                if (resp.ok) {
                    const serverUser = await resp.json();
                    setCurrentUser({ name: serverUser.name, email: serverUser.email, cpf: serverUser.cpf, phone: serverUser.phone });
                    showMessage('signup-msg', 'Conta criada com sucesso! Redirecionando...', true);
                    setTimeout(() => { window.location.href = '/index.html'; }, 900);
                    return;
                } else {
                    const err = await resp.json().catch(() => ({}));
                    showMessage('signup-msg', err.error || 'Não foi possível criar a conta no servidor.', false);
                    return;
                }
            } catch (e) {
                showMessage('signup-msg', 'Não foi possível conectar ao servidor. Tente novamente mais tarde.', false);
                return;
            }
        });
    }

    // ===== Login =====
    // Verifica email+senha contra registros. Em caso de sucesso, define usuário atual.
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;

            // tenta autenticar no backend primeiro
            try {
                const resp = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
                if (resp.ok) {
                    const user = await resp.json();
                    setCurrentUser({ name: user.name, email: user.email, cpf: user.cpf, phone: user.phone });
                    showMessage('login-msg', 'Login bem sucedido! Redirecionando...', true);
                    setTimeout(() => { window.location.href = '/index.html'; }, 700);
                    return;
                }
            } catch (e) {
                // backend indisponível, fallback para localStorage
            }

            const users = getUsers();
            const user = users.find(u => u.email === email && u.password === password);
            if (!user) {
                showMessage('login-msg', 'E-mail ou senha inválidos.', false);
                return;
            }

            // define o usuário atual (sem senha)
            setCurrentUser({ name: user.name, email: user.email, cpf: user.cpf, phone: user.phone });
            showMessage('login-msg', 'Login bem sucedido! Redirecionando...', true);
            setTimeout(() => { window.location.href = '/index.html'; }, 700);
        });
    }

    // ===== Atualiza o header com informações de autenticação =====
    // Quando o usuário estiver logado, o dropdown exibirá links relacionados à conta.
    function updateHeaderAuth() {
        const perfilBtn = document.querySelector('.perfil-btn');
        const dropdown = document.getElementById('perfil-dropdown');
        const adminBellLink = document.getElementById('admin-notifications-link');
        const current = getCurrentUser();
        if (!perfilBtn || !dropdown) return; // segurança caso header não exista

        if (current) {
            // mostra saudação com o nome e gera o conteúdo do dropdown
            const name = current.name || current.email.split('@')[0];
            // determina se o usuário atual tem role 'admin' verificando o registro completo
            let isAdmin = false;
            try {
                const users = getUsers();
                const full = users.find(u => u.email === current.email);
                isAdmin = full && full.role === 'admin';
            } catch (e) { /* ignore */ }

            perfilBtn.textContent = `Olá, ${name}`;
                    if (adminBellLink) adminBellLink.style.display = isAdmin ? 'inline-flex' : 'none';
                    dropdown.innerHTML = `
                <div class="perfil-info">${name}</div>
                ${isAdmin ? '<a href="/admin-usuarios.html">Usuários</a><a href="/admin-viajens.html">Viagens</a><a href="/admin-produtos.html">Produtos</a>' : ''}
                <a href="/perfil-dados.html">Dados da Conta</a>
                <a href="/minhas-compras.html">Minhas Compras</a>
                <a href="/carrinho.html">Carrinho</a>
                <button id="perfil-logout">Sair</button>
            `;
        } else {
            // usuário não autenticado: oferecer link para entrar/criar conta
            perfilBtn.textContent = '👤 Perfil';
            if (adminBellLink) adminBellLink.style.display = 'none';
            dropdown.innerHTML = `<a href="/perfil.html">Entrar / Criar Conta</a>`;
        }

        // se houver botão de logout, anexamos o handler para limpar o usuário atual
        const logoutBtn = document.getElementById('perfil-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                clearCurrentUser();
                updateHeaderAuth();
                // fecha o dropdown e retorna à home
                document.getElementById('perfil-dropdown').setAttribute('aria-hidden', 'true');
                window.location.href = '/index.html';
            });
        }
    }

    // Inicializa estado do header (mostra perfil se já houver usuário logado)
    updateHeaderAuth();

    // Disponibiliza a função para atualizar o header por outras páginas
    window.natripAuth.updateHeaderAuth = updateHeaderAuth;

    // ===== Dropdown toggle behavior =====
    // Abre/fecha o menu de perfil ao clicar no botão; fecha ao clicar fora.
    const perfilBtn = document.querySelector('.perfil-btn');
    const perfilDropdown = document.getElementById('perfil-dropdown');
    if (perfilBtn && perfilDropdown) {
        // ao clicar no botão, alterna atributo aria-hidden
        perfilBtn.addEventListener('click', (ev) => {
            ev.stopPropagation(); // evita que o clique suba para o document
            const open = perfilDropdown.getAttribute('aria-hidden') === 'false';
            perfilDropdown.setAttribute('aria-hidden', open ? 'true' : 'false');
        });

        // fecha o dropdown se o usuário clicar fora
        document.addEventListener('click', () => {
            if (perfilDropdown.getAttribute('aria-hidden') === 'false') {
                perfilDropdown.setAttribute('aria-hidden', 'true');
            }
        });

        // evita que cliques dentro do dropdown fechem o menu
        perfilDropdown.addEventListener('click', (ev) => ev.stopPropagation());

        // ===== Viagens Próximas: carrega e renderiza viagens nos próximos 14 dias =====
        (async function initViagensProximas(){
            const listEl = document.querySelector('.proximas-list');
            if (!listEl) return;

            function parseYMD(dateStr){
                // aceita 'YYYY-MM-DD' e ISO timestamps; retorna Date local (meio-dia para evitar TZ shifts)
                if (!dateStr) return null;
                const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? null : d;
            }

            function formatDate(d){
                if (!d) return '';
                return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
            }

            async function loadTrips(){
                try {
                    const r = await fetch('/api/trips');
                    if (r.ok) return await r.json();
                } catch (e) { /* ignore */ }
                // fallback para localStorage admin trips
                try { return getAdminTrips(); } catch(e){ return []; }
            }

            const all = await loadTrips();
            const today = new Date();
            today.setHours(0,0,0,0);
            const cutoff = new Date(today);
            cutoff.setDate(cutoff.getDate() + 14);

            const proximas = (all || []).map(t => ({
                city: t.city || t.name || 'Destino',
                dateRaw: t.date || t.when || t.dateISO,
                seats: t.seats || t.vagas || 0,
                departureTime: t.departureTime || t.departure || t.dep || '',
                returnTime: t.returnTime || t.return || t.ret || '',
                description: t.description || t.desc || t.meta && (t.meta.description || t.meta.desc) || '',
                meta: t
            }))
            .map(t => ({ ...t, dateObj: parseYMD(t.dateRaw) }))
            .filter(t => t.dateObj && t.dateObj.getTime() >= today.getTime() && t.dateObj.getTime() <= cutoff.getTime())
            .sort((a,b) => a.dateObj - b.dateObj);

            if (!proximas || proximas.length === 0){
                listEl.innerHTML = '<p style="color:#666">Nenhuma viagem programada nas próximas 2 semanas.</p>';
                return;
            }

            function slugifyCity(name){
                if (!name) return '';
                return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
            }

            function guessCityImage(city){
                const slug = slugifyCity(city);
                const candidates = [
                    `img/cidades/${slug}/img1.jpg`,
                    `img/cidades/${slug}/img1.jpeg`,
                    `img/cidades/${slug}/img1.png`,
                    `img/cidades/${slug}/img1.jfif`,
                    `img/cidades/${slug}/img1.webp`
                ];
                for (const p of candidates) {
                    // We can't synchronously test file existence in browser; use first candidate and let broken images fallback via CSS
                    return p;
                }
                return 'img/placeholder.jpg';
            }

            listEl.innerHTML = proximas.map(t => {
                const iso = `${t.dateObj.getFullYear()}-${String(t.dateObj.getMonth()+1).padStart(2,'0')}-${String(t.dateObj.getDate()).padStart(2,'0')}`;
                const href = `cidade.html?nome=${encodeURIComponent(t.city)}&date=${iso}`;
                const img = guessCityImage(t.city);
                return `
                <div class="prox-card">
                    <div class="pc-thumb" style="background-image:url('${img}')" aria-hidden="true"></div>
                    <div class="pc-body">
                        <div class="pc-left">
                            <strong>${t.city}</strong>
                            <div class="pc-date">${formatDate(t.dateObj)}</div>
                            ${ (t.departureTime || t.returnTime) ? `<div class="pc-time">${t.departureTime ? `Saída: ${t.departureTime}` : ''}${(t.departureTime && t.returnTime) ? ' • ' : ''}${t.returnTime ? `Volta: ${t.returnTime}` : ''}</div>` : '' }
                            ${t.description ? `<div class="pc-desc">${t.description}</div>` : ''}
                        </div>
                        <div class="pc-right">
                            <div class="pc-seats">Vagas: ${t.seats}</div>
                            <a href="${href}" class="pc-btn">Ver</a>
                        </div>
                    </div>
                </div>
            `}).join('');
        })();
    }
    })();
});
