import { db, collection, getDocs, onAuthStateChanged, auth, getDoc, doc, signOut } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const tbody = document.getElementById('items-tbody');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    
    // Filtros
    const searchInput = document.getElementById('searchInput');
    const filterState = document.getElementById('filterState');
    const filterFamily = document.getElementById('filterFamily');

    // Procesamiento de Imágenes
    const imageProcessorInput = document.getElementById('imageProcessorInput');
    const webpCanvas = document.getElementById('webpCanvas');
    let currentProcessingCode = null;

    let allItems = [];

    // Verificación de autenticación
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDisplayNameElement) {
            userDisplayNameElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
        }

        loadCatalog();
    });

    const formatCode = (rawCode) => {
        if (!rawCode) return '-';
        let code = String(rawCode).trim();
        // Si el código tiene exactamente 7 dígitos y no tiene guiones, lo formateamos a 2-3-2
        if (/^\d{7}$/.test(code)) {
            return `${code.substring(0, 2)}-${code.substring(2, 5)}-${code.substring(5, 7)}`;
        }
        return code;
    };

    const loadCatalog = async () => {
        loadingState.style.display = 'flex';
        emptyState.style.display = 'none';
        tbody.innerHTML = '';
        
        try {
            // Se asume que la colección se llama catalogo_items
            const querySnapshot = await getDocs(collection(db, "catalogo_items"));
            allItems = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                codigo_format: formatCode(doc.data().codigo)
            }));

            // ----- MOCK DATA -----
            // Si la colección de Firebase no existe o está vacía, cargamos simulador
            if (allItems.length === 0) {
                console.warn("Base de datos vacía. Cargando simulador de ítems...");
                allItems = [
                    { codigo_format: "39-100-50", descripcion: "MINIPLACA EN T 2,7 MM X 3 ORIF TI", estado: "Presente", familia: "100" },
                    { codigo_format: "39-100-60", descripcion: "MINIPLACA EN L 2,7 MM X 3 ORIF TI DER", estado: "A revisar", familia: "100" },
                    { codigo_format: "39-010-08", descripcion: "MINIPLACA RECTANGUAR 1,5 MM X8 ORIF TI", estado: "No aprobada", familia: "010" },
                    { codigo_format: "42-144-56", descripcion: "TORNILLO CORTICAL 1.5 MM x 12 MM", estado: "Fuera de uso", familia: "144" },
                    { codigo_format: "42-144-56", descripcion: "TORNILLO CORTICAL REPETIDO", estado: "Descripcion repetida", familia: "144" }
                ];
            }

            populateFamilyFilter(allItems);
            applyFilters();

        } catch (error) {
            console.error("Error al cargar el catálogo:", error);
            emptyState.style.display = 'flex';
        } finally {
            loadingState.style.display = 'none';
        }
    };

    const populateFamilyFilter = (items) => {
        const families = [...new Set(items.map(i => i.familia).filter(f => f))].sort();
        filterFamily.innerHTML = '<option value="">FAMILIA (TODAS)</option>';
        families.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.toLowerCase();
            opt.textContent = f;
            filterFamily.appendChild(opt);
        });
    };

    const getBadgeStyle = (estado) => {
        const estadoNorm = (estado || '').toLowerCase();
        // A revisar: Amarillo apagado
        if (estadoNorm.includes('revisar')) return "bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400";
        // Presente: Verde opaco claro
        if (estadoNorm === 'presente') return "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400";
        // No aprobada: Azul oscuro letras blancas
        if (estadoNorm.includes('no aprobada')) return "bg-[#1e3a8a] text-white";
        // Descripcion repetida: Gris neutro oscuro
        if (estadoNorm.includes('repetida')) return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
        // Fuera de uso: Celeste claro opaco
        if (estadoNorm.includes('fuera de uso')) return "bg-sky-100/80 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
        
        // Default
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    };

    let currentRenderedCount = 0;
    const RENDER_CHUNK_SIZE = 50;
    let currentFilteredItems = [];

    // Configuramos el modal y visor 3D genéricos una sola vez
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modal3d = document.getElementById('modal-3d');
    const modalCaption = document.getElementById('modal-caption');

    const openModal = () => {
        imageModal.classList.remove('hidden');
        void imageModal.offsetWidth; // Reflow
        imageModal.classList.add('opacity-100');
    };

    modal3d?.addEventListener('error', (e) => {
         modalCaption.textContent = `Error: Archivo 3D no encontrado para ${modalCaption.textContent.split(': ')[1]}`;
         modal3d.classList.add('hidden');
    });

    // Sentinel para infinite scroll
    const tableContainer = document.querySelector('.overflow-auto.custom-scrollbar');
    const observerSentinel = document.createElement('div');
    observerSentinel.className = 'w-full py-6 flex justify-center items-center text-slate-400';
    observerSentinel.innerHTML = `<span class="material-symbols-outlined animate-spin text-[32px]">autorenew</span>`;
    observerSentinel.style.display = 'none';
    tableContainer.appendChild(observerSentinel);

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && currentRenderedCount < currentFilteredItems.length) {
            renderItems(null, false);
        }
    }, { root: tableContainer, rootMargin: "100px" });
    observer.observe(observerSentinel);

    function renderItems(items, isInitialRender = true) {
        if (isInitialRender) {
            currentFilteredItems = items || [];
            currentRenderedCount = 0;
            tbody.innerHTML = '';
            
            if (currentFilteredItems.length === 0) {
                emptyState.style.display = 'flex';
                observerSentinel.style.display = 'none';
                return;
            }
            emptyState.style.display = 'none';
        }

        const chunk = currentFilteredItems.slice(currentRenderedCount, currentRenderedCount + RENDER_CHUNK_SIZE);
        if (chunk.length === 0) return;

        const fragment = document.createDocumentFragment();

        chunk.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors';
            
            const badgeStyle = getBadgeStyle(item.estado);
            const imgPath = `../assets/items/${item.codigo_format}.webp`;
            
            tr.innerHTML = `
                <td class="py-2 px-4 text-center">
                    <div class="relative w-[72px] h-[72px] mx-auto rounded-lg border border-slate-200 dark:border-slate-300 bg-slate-100 dark:bg-slate-200 overflow-hidden shadow-inner flex items-center justify-center">
                        <span class="material-symbols-outlined text-[24px] text-slate-300 dark:text-slate-400 absolute z-0">image</span>
                        <img src="${imgPath}" alt="${item.codigo_format}" 
                            class="w-[90%] h-[90%] object-contain relative z-10 transition-transform group-hover:scale-105"
                            onerror="this.style.opacity='0'"
                            onload="this.style.opacity='1'; this.previousElementSibling.style.display='none'">
                        
                        <div class="absolute inset-0 z-20 flex flex-col md:flex-row items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 p-1">
                            <button class="view-3d-btn p-1 md:p-1.5 rounded-md bg-purple-500/90 hover:bg-purple-600 dark:bg-purple-500/80 dark:hover:bg-purple-500 text-white shadow-sm transition-colors" title="Ver modelo 3D">
                                <span class="material-symbols-outlined text-[18px] md:text-[20px]">3d_rotation</span>
                            </button>
                            <button class="add-img-btn p-1 md:p-1.5 rounded-md bg-villalba-blue/90 hover:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-sm transition-colors" title="Cambiar foto">
                                <span class="material-symbols-outlined text-[18px] md:text-[20px]">upload</span>
                            </button>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight whitespace-nowrap block">${item.codigo_format}</span>
                </td>
                <td class="py-3 px-4">
                    <p class="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-[400px] md:max-w-none whitespace-normal" title="${item.descripcion || '-'}">
                        ${item.descripcion || '-'}
                    </p>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2.5 py-1 rounded border border-transparent dark:border-white/5 text-[9.5px] font-black uppercase tracking-widest ${badgeStyle}">
                        ${item.estado || 'SIN ESTADO'}
                    </span>
                </td>
                <td class="py-3 px-4 text-center">
                    <span class="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-[10.5px] font-black tracking-widest text-slate-500 shadow-sm">
                        ${item.familia || 'N/A'}
                    </span>
                </td>
            `;
            
            // Assign localized event listeners for the inline buttons
            tr.querySelector('.add-img-btn').addEventListener('click', () => {
                currentProcessingCode = item.codigo_format;
                imageProcessorInput.click();
            });

            tr.querySelector('.view-3d-btn').addEventListener('click', () => {
                const code = item.codigo_format;
                const glbPath = `../assets/3d/${code}.glb`;
                modalImage.classList.add('hidden');
                modal3d.classList.remove('hidden');
                if (modal3d.getAttribute('src') !== glbPath) modal3d.src = glbPath;
                modalCaption.textContent = `Modelo 3D - Código: ${code}`;
                openModal();
            });
            
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
        currentRenderedCount += chunk.length;

        // Mostrar o esconder el sentinel
        setTimeout(() => {
            observerSentinel.style.display = currentRenderedCount < currentFilteredItems.length ? 'flex' : 'none';
        }, 100);
    };

    // LOGICA DE CONVERSIÓN DE IMAGEN PARA LOCAL ASSETS
    imageProcessorInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !currentProcessingCode) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const ctx = webpCanvas.getContext('2d');
                // Mantener proporciones, max 800px ancho
                const maxW = 400; 
                const scale = Math.min(maxW / img.width, 1);
                webpCanvas.width = img.width * scale;
                webpCanvas.height = img.height * scale;
                
                // Limpiar el canvas totalmente para transparencia
                ctx.clearRect(0, 0, webpCanvas.width, webpCanvas.height);
                ctx.drawImage(img, 0, 0, webpCanvas.width, webpCanvas.height);

                const webpDataUrl = webpCanvas.toDataURL('image/webp', 0.85); // 85% calidad compresión

                // Forzar descarga al navegador
                const a = document.createElement('a');
                a.href = webpDataUrl;
                a.download = `${currentProcessingCode}.webp`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                alert(`Imagen convertida y guardada en 'Descargas' como ${currentProcessingCode}.webp\n\nInstrucción:\nMás tarde, mueva este archivo a la carpeta public/assets/items/ de su proyecto.`);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        // reset input
        imageProcessorInput.value = '';
    });

    function applyFilters() {
        const term = searchInput.value.toLowerCase();
        const estFilter = filterState.value.toLowerCase();
        const famFilter = filterFamily.value.toLowerCase();

        const filtered = allItems.filter(item => {
            const codigo = (item.codigo_format || '').toLowerCase();
            const desc = (item.descripcion || '').toLowerCase();
            const fam = (item.familia || '').toLowerCase();
            const est = (item.estado || '').toLowerCase();

            const matchesSearch = codigo.includes(term) || desc.includes(term);
            const matchesState = estFilter === '' || est === estFilter;
            const matchesFamily = famFilter === '' || fam === famFilter;

            return matchesSearch && matchesState && matchesFamily;
        });

        renderItems(filtered);
    };

    searchInput.addEventListener('input', applyFilters);
    filterState.addEventListener('change', applyFilters);
    filterFamily.addEventListener('change', applyFilters);

    // Modal de imagen/3D cerrar
    const closeModal = () => {
        imageModal.classList.remove('opacity-100');
        setTimeout(() => {
            imageModal.classList.add('hidden');
        }, 300);
    };

    document.getElementById('close-image-modal')?.addEventListener('click', closeModal);
    imageModal?.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            closeModal();
        }
    });

    // Cerrar sesión
    logoutBtn?.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = '../login.html';
        }).catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
    });
});
