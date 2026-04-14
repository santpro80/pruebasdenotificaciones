import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, updateDoc,
    registrarHistorial
} from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const boxSerialNumberDisplay = document.getElementById("box-serial-number-display");
    const itemsList = document.getElementById("itemsList");
    const addItemBtn = document.getElementById("add-item-btn");
    const backBtn = document.getElementById("back-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userDisplayName = document.getElementById("user-display-name");
    const loadingState = document.getElementById("loading-state");
    const errorState = document.getElementById("error-state");
    const emptyState = document.getElementById("empty-state");
    const searchInput = document.getElementById("searchInput");

    let currentSerialNumber = "";
    let currentModelName = "";
    let currentZonaName = "";
    let allItems = [];
    let notificationTimeout;

    const showNotification = (message, type = "success") => {
        const toast = document.getElementById("notification-toast");
        const icon = document.getElementById("toast-icon");
        const msg = document.getElementById("toast-message");
        if (!toast || !icon || !msg) return;

        clearTimeout(notificationTimeout);
        msg.textContent = message;
        icon.textContent = type === "success" ? "check_circle" : (type === "error" ? "error" : "info");
        
        toast.className = `fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-full transition-all duration-500 pointer-events-auto opacity-100 -translate-y-4 ${type === "success" ? "text-emerald-500" : (type === "error" ? "text-rose-500" : "text-villalba-blue")}`;

        notificationTimeout = setTimeout(() => {
            toast.classList.add("opacity-0", "translate-y-8");
            toast.classList.remove("opacity-100", "-translate-y-4");
            toast.style.pointerEvents = "none";
        }, 3000);
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDisplayName) {
                userDisplayName.textContent = userDocSnap.exists() ? userDocSnap.data().name : user.email;
            }
        } catch (error) {
            console.error(error);
        }

        loadItems();
    });

    const showState = (stateElement) => {
        [loadingState, errorState, emptyState, itemsList].forEach(el => {
            if (el) el.classList.add("hidden");
        });

        if (stateElement) {
            stateElement.classList.remove("hidden");
            if (stateElement === itemsList) {
                stateElement.classList.add("flex");
            }
        }
    };

    const loadItems = async () => {
        showState(loadingState);
        const urlParams = new URLSearchParams(window.location.search);
        currentSerialNumber = urlParams.get("selectedSerialNumber");
        currentModelName = urlParams.get("modelName");
        currentZonaName = urlParams.get("zonaName");

        if (!currentSerialNumber) {
            boxSerialNumberDisplay.textContent = "Error: Sin serie";
            showState(errorState);
            return;
        }

        boxSerialNumberDisplay.textContent = currentSerialNumber.toUpperCase();

        try {
            const itemDocRef = doc(db, "Items", currentSerialNumber);
            const itemDocSnap = await getDoc(itemDocRef);

            if (itemDocSnap.exists()) {
                const data = itemDocSnap.data();
                allItems = data.productos || [];
                renderItems(allItems);
            } else {
                showState(emptyState);
            }
        } catch (error) {
            console.error(error);
            showState(errorState);
        }
    };

    const renderItems = (items) => {
        itemsList.innerHTML = "";
        if (items.length === 0) {
            showState(emptyState);
            return;
        }

        items.forEach((item, index) => {
            const li = document.createElement("li");
            li.className = "bg-white dark:bg-slate-800/40 rounded-2xl p-4 lg:p-5 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-villalba-blue/40 hover:-translate-y-1 dark:hover:border-villalba-blue/50 flex flex-col md:flex-row items-start md:items-center gap-4 group transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl relative overflow-hidden";
            const isReemplazar = (item.serial || "").toUpperCase() === 'REEMPLAZAR';
            const badgeClass = isReemplazar 
                ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400" 
                : "bg-villalba-blue/10 text-villalba-blue dark:bg-villalba-blue/20 dark:text-villalba-blue/90";
            
            let serialHtml = "";
            if (item.serial) {
                serialHtml = `<span class="text-[13px] font-black px-4 py-2 rounded-xl ${badgeClass} tracking-widest whitespace-nowrap shadow-sm">SN: <span class="font-mono">${item.serial}</span></span>`;
            }

            li.innerHTML = `
                <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-[120px_1fr_150px] gap-4 items-center relative z-10">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 shrink-0 rounded-xl bg-villalba-blue/5 dark:bg-villalba-blue/10 flex items-center justify-center text-villalba-blue transition-colors group-hover:bg-villalba-blue group-hover:text-white">
                            <span class="material-symbols-outlined text-[20px]">${item.tipo === "producto" ? "inventory_2" : "settings"}</span>
                        </div>
                        <span class="text-xs font-black tracking-widest text-slate-500 uppercase group-hover:text-villalba-blue transition-colors">${item.codigo || "S/N"}</span>
                    </div>
                    
                    <h3 class="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight uppercase break-words" title="${item.descripcion || "Sin descripción"}">${item.descripcion || "Sin descripción"}</h3>
                    
                    <div class="flex items-center md:justify-end pr-2">
                        ${serialHtml}
                    </div>
                </div>
                <div class="absolute inset-0 bg-gradient-to-r from-villalba-blue/0 to-villalba-blue/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            `;

            itemsList.appendChild(li);
        });

        showState(itemsList);
    };

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allItems.filter(item => 
                (item.codigo && item.codigo.toLowerCase().includes(term)) ||
                (item.descripcion && item.descripcion.toLowerCase().includes(term)) ||
                (item.serial && item.serial.toLowerCase().includes(term))
            );
            renderItems(filtered);
        });
    }

    addItemBtn.addEventListener("click", () => {
        window.location.href = `agregar-item.html?selectedSerialNumber=${encodeURIComponent(currentSerialNumber)}&modelName=${encodeURIComponent(currentModelName)}&zonaName=${encodeURIComponent(currentZonaName)}`;
    });

    backBtn.addEventListener("click", () => {
        window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(currentModelName)}&zonaName=${encodeURIComponent(currentZonaName)}`;
    });

    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "../login.html";
    });
});
