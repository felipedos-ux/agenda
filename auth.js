// Sistema de Autenticação EDUCAR

// Usuários do sistema
const users = {
    'secretaria@educar.com': {
        password: 'secretaria',
        role: 'secretaria',
        name: 'Secretaria Escolar',
        dashboard: 'secretaria.html'
    },
    'diretor@educar.com': {
        password: 'diretor',
        role: 'diretor',
        name: 'Diretor(a)',
        dashboard: 'diretor.html'
    },
    'prof.maria@educar.com': {
        password: 'professor',
        role: 'professor',
        name: 'Profª Maria Silva',
        dashboard: 'professor.html'
    },
    'aluno.joao@educar.com': {
        password: 'aluno',
        role: 'aluno',
        name: 'João Santos',
        dashboard: 'aluno.html'
    },
    'pai.joao@educar.com': {
        password: 'responsavel',
        role: 'responsavel',
        name: 'Responsável - João Santos',
        dashboard: 'responsavel.html'
    }
};

// Verificar se já está logado
function checkAuth() {
    const currentUser = localStorage.getItem('educar_user');
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentUser && currentPage === 'login.html') {
        // Se já está logado e está na página de login, redirecionar para dashboard
        const user = JSON.parse(currentUser);
        window.location.href = user.dashboard;
    } else if (!currentUser && currentPage !== 'login.html' && currentPage !== '') {
        // Se não está logado e não está na página de login, redirecionar para login
        window.location.href = 'login.html';
    }
}

// Executar verificação ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Se estiver na página de login, configurar o formulário
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Se estiver em um dashboard, carregar informações do usuário
    const currentUser = localStorage.getItem('educar_user');
    if (currentUser) {
        loadUserInfo(JSON.parse(currentUser));
    }
    
    // Configurar botão de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Configurar menu toggle para mobile
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
        
        // Fechar sidebar ao clicar fora (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }
});

// Função de login
function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    // Validar credenciais
    const user = users[email];
    
    if (!user) {
        showError('E-mail não encontrado');
        return;
    }
    
    if (user.password !== password) {
        showError('Senha incorreta');
        return;
    }
    
    // Login bem-sucedido
    const userData = {
        email: email,
        name: user.name,
        role: user.role,
        dashboard: user.dashboard
    };
    
    // Salvar no localStorage
    localStorage.setItem('educar_user', JSON.stringify(userData));
    
    // Redirecionar para o dashboard apropriado
    window.location.href = user.dashboard;
}

// Função de logout
function handleLogout(e) {
    e.preventDefault();
    
    if (confirm('Deseja realmente sair do sistema?')) {
        localStorage.removeItem('educar_user');
        window.location.href = 'login.html';
    }
}

// Carregar informações do usuário no dashboard
function loadUserInfo(user) {
    // Atualizar nome do usuário
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(el => {
        el.textContent = user.name;
    });
    
    // Atualizar role do usuário
    const userRoleElements = document.querySelectorAll('.user-role');
    userRoleElements.forEach(el => {
        el.textContent = getRoleLabel(user.role);
    });
    
    // Atualizar avatar com inicial do nome
    const userAvatarElements = document.querySelectorAll('.user-avatar');
    userAvatarElements.forEach(el => {
        el.textContent = user.name.charAt(0).toUpperCase();
    });
}

// Obter label do papel do usuário
function getRoleLabel(role) {
    const labels = {
        'secretaria': 'Secretaria',
        'diretor': 'Diretor(a)',
        'professor': 'Professor(a)',
        'aluno': 'Aluno(a)',
        'responsavel': 'Responsável'
    };
    return labels[role] || role;
}

// Mostrar mensagem de erro
function showError(message) {
    // Remover erro anterior se existir
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Criar elemento de erro
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #fee2e2;
        border: 1px solid #ef4444;
        color: #991b1b;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    errorDiv.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${message}</span>
    `;
    
    // Inserir antes do formulário
    const form = document.getElementById('loginForm');
    form.parentNode.insertBefore(errorDiv, form);
    
    // Remover após 5 segundos
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Função auxiliar para obter usuário atual
function getCurrentUser() {
    const userData = localStorage.getItem('educar_user');
    return userData ? JSON.parse(userData) : null;
}

// Exportar funções para uso global
window.educarAuth = {
    getCurrentUser,
    handleLogout,
    checkAuth
};
