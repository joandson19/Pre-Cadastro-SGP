'use strict';

/**
 * Script do formulário (substitui o antigo submitForm.js + config.js).
 *
 * IMPORTANTE: este arquivo é público (qualquer visitante pode lê-lo).
 * Por isso ele NÃO contém token, app, chat id nem URL do SGP: fala apenas
 * com api/opcoes.php e api/cadastro.php, que guardam os segredos no servidor.
 */

(() => {
    const API_OPCOES = 'api/opcoes.php';
    const API_CADASTRO = 'api/cadastro.php';

    const $ = (id) => document.getElementById(id);

    // ───────────── Mensagens de erro ─────────────
    function mostrarErro(campo, mensagem) {
        const alvo = $(campo);
        if (!alvo) return;
        let el = $(`${campo}-erro`);
        if (!el) {
            el = document.createElement('div');
            el.id = `${campo}-erro`;
            el.className = 'error-message';
            alvo.after(el);
        }
        el.textContent = mensagem;
    }

    function limparErro(campo) {
        const el = $(`${campo}-erro`);
        if (el) el.remove();
    }

    function limparTodosErros() {
        document.querySelectorAll('.error-message').forEach((el) => el.remove());
    }

    // ───────────── Verificação anti-robô (Cloudflare Turnstile) ─────────────
    let turnstileAtivo = false;
    let turnstileToken = '';
    let turnstileWidgetId = null;

    function iniciarTurnstile(siteKey) {
        turnstileAtivo = true;
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            turnstileWidgetId = window.turnstile.render('#turnstileBox', {
                sitekey: siteKey,
                language: 'pt-br',
                callback: (token) => { turnstileToken = token; limparErro('turnstileBox'); },
                'expired-callback': () => { turnstileToken = ''; },
                'error-callback': () => { turnstileToken = ''; }
            });
        };
        script.onerror = () => {
            mostrarErro('turnstileBox', 'Não foi possível carregar a verificação de segurança. Recarregue a página.');
        };
        document.head.appendChild(script);
    }

    // ───────────── Carga de planos, vencimentos e vendedores ─────────────
    let coordenadasIni = [-12.1356, -38.4193]; // padrão caso o servidor não informe

    function preencherSelect(select, itens, valor, rotulo) {
        itens.forEach((item) => {
            const option = document.createElement('option');
            option.value = valor(item);
            option.textContent = rotulo(item); // textContent: nunca interpreta HTML
            select.appendChild(option);
        });
    }

    async function carregarOpcoes() {
        try {
            const resp = await fetch(API_OPCOES);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const dados = await resp.json();

            preencherSelect($('plano'), dados.planos, (p) => p.id, (p) => `${p.descricao} - R$ ${p.valor}`);
            preencherSelect($('vencimento'), dados.vencimentos, (v) => v.id, (v) => `Dia ${v.dia}`);
            preencherSelect($('vendedor'), dados.vendedores, (v) => v.id, (v) => v.nome);

            if (dados.turnstileSiteKey) iniciarTurnstile(dados.turnstileSiteKey);

            if (dados.mapaInicial) {
                const [lat, lng] = dados.mapaInicial.split(',').map(Number);
                if (Number.isFinite(lat) && Number.isFinite(lng)) coordenadasIni = [lat, lng];
            }
        } catch (error) {
            console.error('Erro ao buscar opções:', error);
            mostrarErro('plano', 'Não foi possível carregar os planos. Recarregue a página.');
        }
    }

    carregarOpcoes();

    // ───────────── Validação de CPF/CNPJ (apenas conveniência; o servidor revalida) ─────────────
    function validarCPFouCNPJ(valor) {
        const d = valor.replace(/\D/g, '');
        if (/^(\d)\1+$/.test(d)) return false;

        if (d.length === 11) {
            const dv = (n) => {
                let soma = 0;
                for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
                const r = soma % 11;
                return r < 2 ? 0 : 11 - r;
            };
            return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
        }

        if (d.length === 14) {
            const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
            const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
            const dv = (n, pesos) => {
                let soma = 0;
                for (let i = 0; i < n; i++) soma += Number(d[i]) * pesos[i];
                const r = soma % 11;
                return r < 2 ? 0 : 11 - r;
            };
            return dv(12, p1) === Number(d[12]) && dv(13, p2) === Number(d[13]);
        }
        return false;
    }

    $('cpfcnpj').addEventListener('blur', function () {
        if (!this.value) return;
        if (!validarCPFouCNPJ(this.value)) {
            mostrarErro('cpfcnpj', 'CPF ou CNPJ inválido! Por favor, verifique.');
        } else {
            limparErro('cpfcnpj');
        }
    });

    // ───────────── Busca automática de CEP (ViaCEP não exige credencial) ─────────────
    $('cep').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
    });

    $('cep').addEventListener('blur', async function () {
        const cep = this.value.replace(/\D/g, '');
        if (!cep) return;

        if (cep.length !== 8) {
            alert('CEP inválido! Digite 8 números.');
            return;
        }

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                alert('CEP não encontrado!');
                return;
            }

            $('logradouro').value = data.logradouro || '';
            $('bairro').value = data.bairro || '';
            $('cidade').value = data.localidade || '';
            $('uf').value = data.uf || '';
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            alert('Erro ao consultar CEP.');
        }
    });

    // ───────────── Mapa ─────────────
    const form = $('registrationForm');
    const enableMapCheckbox = $('enableMap');
    const mapContainer = $('mapContainer');
    const mapElement = $('map');
    const mapInput = $('map_ll');
    const getLocationButton = $('getLocationButton');
    const centerMapButton = $('centerMapButton');

    let map;
    let marker;

    const formatarCoordenadas = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

    enableMapCheckbox.addEventListener('change', () => {
        if (enableMapCheckbox.checked) {
            mapContainer.classList.remove('hidden');

            if (!map) {
                const [latitude, longitude] = coordenadasIni;
                map = L.map(mapElement).setView([latitude, longitude], 14);

                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 18,
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                }).addTo(map);

                marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);

                marker.on('dragend', () => {
                    const { lat, lng } = marker.getLatLng();
                    mapInput.value = formatarCoordenadas(lat, lng);
                });

                map.on('click', (e) => {
                    const { lat, lng } = e.latlng;
                    marker.setLatLng([lat, lng]);
                    mapInput.value = formatarCoordenadas(lat, lng);
                });
            }
        } else {
            mapContainer.classList.add('hidden');
            mapInput.value = '';
        }
    });

    getLocationButton.addEventListener('click', () => {
        if (!map || !marker) {
            alert('O mapa ainda não foi inicializado. Ative o mapa primeiro.');
            return;
        }

        if (!navigator.geolocation) {
            alert('Geolocalização não é suportada pelo seu navegador.');
            return;
        }

        getLocationButton.disabled = true;
        getLocationButton.textContent = 'Obtendo localização...';

        const resetButton = () => {
            getLocationButton.disabled = false;
            getLocationButton.textContent = 'Usar minha localização atual';
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 14);
                marker.setLatLng([latitude, longitude]);
                mapInput.value = formatarCoordenadas(latitude, longitude);
                resetButton();
            },
            (error) => {
                console.error('Erro ao obter localização:', error);
                alert('Não foi possível obter sua localização. Por favor, verifique as permissões.');
                resetButton();
            },
            { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
        );
    });

    centerMapButton.addEventListener('click', () => {
        if (!map || !marker) {
            alert('O mapa ainda não foi inicializado. Ative o mapa primeiro.');
            return;
        }
        const [latitude, longitude] = coordenadasIni;
        map.setView([latitude, longitude], 14);
        marker.setLatLng([latitude, longitude]);
        mapInput.value = formatarCoordenadas(latitude, longitude);
    });

    // ───────────── Envio do formulário ─────────────
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        limparTodosErros();

        if (!validarCPFouCNPJ($('cpfcnpj').value)) {
            mostrarErro('cpfcnpj', 'CPF ou CNPJ inválido! Por favor, verifique.');
            $('cpfcnpj').focus();
            return;
        }

        if (turnstileAtivo && !turnstileToken) {
            alert('Aguarde a verificação de segurança concluir (ou confirme que você não é um robô) e tente novamente.');
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        // Somente os dados do formulário: nenhuma credencial é enviada pelo navegador
        const dados = Object.fromEntries(new FormData(form));
        dados.turnstile_token = turnstileToken;

        try {
            const response = await fetch(API_CADASTRO, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const resultado = await response.json().catch(() => ({}));

            if (response.ok) {
                window.location.href = 'cadastro-sucesso.html';
                return;
            }

            // Erros de validação por campo vindos do servidor
            if (resultado.campos) {
                Object.entries(resultado.campos).forEach(([campo, mensagem]) => {
                    mostrarErro(campo === 'vendedor_id' ? 'vendedor' : campo, mensagem);
                });
            }
            const detalhes = resultado.campos ? `\n\n${Object.values(resultado.campos).join('\n')}` : '';
            alert((resultado.erro || 'Erro ao cadastrar. Tente novamente.') + detalhes);
        } catch (error) {
            console.error('Erro ao enviar o formulário:', error);
            alert('Erro de conexão. Tente novamente.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Cadastrar';
            // O token do Turnstile vale para uma única verificação: pede um novo a cada tentativa
            if (turnstileWidgetId !== null && window.turnstile) {
                window.turnstile.reset(turnstileWidgetId);
                turnstileToken = '';
            }
        }
    });
})();
