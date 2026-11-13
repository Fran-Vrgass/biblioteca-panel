// CONEXIÓN DEL PANEL CON SUPABASE

const SUPABASE_URL = "https://yhzoryuhrrkggtlyppjt.supabase.co";
const SUPABASE_KEY = "sb_publishable_Kaw2rZJutbc5BmrIrEmN6Q_A7kSUebl";

const supabasePanel = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Panel conectado con Supabase");
// INICIO DE SESIÓN

const formularioLogin = document.getElementById("formularioLogin");

formularioLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    const carnet = document.getElementById("carnetLogin").value.trim();
    const clave = document.getElementById("claveLogin").value;
    const mensaje = document.getElementById("mensajeLogin");

    mensaje.textContent = "Verificando acceso...";

    const { data, error } = await supabasePanel.functions.invoke(
        "verificar-bibliotec-logo",
        {
            body: {
                carnet: carnet,
                password: clave
            }
        }
    );

    if (error || !data?.access_token || !data?.refresh_token) {
        mensaje.textContent = data?.error || "Carné o contraseña incorrectos.";
        return;
    }

    const { error: errorSesion } = await supabasePanel.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
    });

    if (errorSesion) {
        mensaje.textContent = "No se pudo iniciar la sesión.";
        return;
    }

document.getElementById("inicioSesion").style.display = "none";
document.querySelector(".panel").style.display = "block";

cargarIngresos();
cargarActividades();
iniciarAtenciones();
});

// CONSULTAR INGRESOS REALES DE SUPABASE

async function cargarIngresos() {
    const tabla = document.getElementById("tablaIngresos");
    const total = document.getElementById("totalIngresos");

    tabla.innerHTML = `
        <tr>
            <td colspan="4">Consultando registros...</td>
        </tr>
    `;

    const { data, error } = await supabasePanel.functions.invoke(
        "consultar-ingresos"
    );

    if (error || !data) {
        tabla.innerHTML = `
            <tr>
                <td colspan="4">No se pudieron cargar los ingresos.</td>
            </tr>
        `;
        console.error("Error al consultar ingresos:", error);
        return;
    }

    total.textContent = data.totalHoy;

    tabla.innerHTML = "";

    if (!data.ingresos || data.ingresos.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="4">No hay ingresos registrados.</td>
            </tr>
        `;
        return;
    }

    data.ingresos.forEach((ingreso) => {
        const fila = document.createElement("tr");

        const fecha = new Date(ingreso.fecha_hora);

        const hora = fecha.toLocaleTimeString("es-CR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Costa_Rica"
        });

        
            const valores = [
                hora,
                atencion.carnet || "—",
                atencion.actividad,
                atencion.atendida ? "Atendida" : "Pendiente"
            ];

            valores.forEach(valor => {
                const celda = document.createElement("td");
                celda.textContent = valor;
                fila.appendChild(celda);
            });

            const celdaAccion = document.createElement("td");

            if (!atencion.atendida) {
                const botonAtender = document.createElement("button");

                botonAtender.type = "button";
                botonAtender.textContent = "✓";
                botonAtender.title = "Marcar como atendida";
                botonAtender.setAttribute(
                    "aria-label",
                    "Marcar atención como atendida"
                );

                botonAtender.addEventListener("click", async () => {
                    botonAtender.disabled = true;
                    botonAtender.textContent = "…";

                    try {
                        const { data, error } =
                            await supabasePanel.functions.invoke(
                                "marcar-atencion-atendida",
                                {
                                    body: { id: atencion.id }
                                }
                            );

                        if (error || !data?.success) {
                            alert(
                                data?.error ||
                                "No se pudo marcar la atención."
                            );

                            botonAtender.disabled = false;
                            botonAtender.textContent = "✓";
                            return;
                        }

                        await cargarAtenciones();

                    } catch (error) {
                        console.error(
                            "Error al marcar atención:",
                            error
                        );

                        alert("Ocurrió un error al marcar la atención.");

                        botonAtender.disabled = false;
                        botonAtender.textContent = "✓";
                    }
                });

                celdaAccion.appendChild(botonAtender);
            } else {
                celdaAccion.textContent = "✓";
            }

            fila.appendChild(celdaAccion);
            tablaAtenciones.appendChild(fila);
    });
}

 // ==========================================
 // MÓDULO DE ATENCIÓN
 // ==========================================

const tablaAtenciones = document.getElementById("tablaAtenciones");
const contadorAtenciones = document.getElementById("atencionesPendientes");

let atencionesConocidas = new Set();
let atencionesInicializadas = false;
let consultaAtencionesEnCurso = false;
let intervaloAtenciones = null;
let contextoSonidoAtencion = null;

// Preparar sonido después de la interacción del usuario.
function prepararSonidoAtencion() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;

        if (!AudioContext) return;

        if (!contextoSonidoAtencion) {
            contextoSonidoAtencion = new AudioContext();
        }

        if (contextoSonidoAtencion.state === "suspended") {
            contextoSonidoAtencion.resume().catch(() => {});
        }
    } catch (error) {
        console.warn("No se pudo preparar el sonido:", error);
    }
}

// Reproducir una notificación breve.
function reproducirSonidoAtencion() {
    try {
        if (!contextoSonidoAtencion ||
            contextoSonidoAtencion.state !== "running") {
            return;
        }

        const oscilador = contextoSonidoAtencion.createOscillator();
        const volumen = contextoSonidoAtencion.createGain();

        oscilador.type = "sine";
        oscilador.frequency.setValueAtTime(
            880,
            contextoSonidoAtencion.currentTime
        );

        volumen.gain.setValueAtTime(
            0.12,
            contextoSonidoAtencion.currentTime
        );

        volumen.gain.exponentialRampToValueAtTime(
            0.001,
            contextoSonidoAtencion.currentTime + 0.35
        );

        oscilador.connect(volumen);
        volumen.connect(contextoSonidoAtencion.destination);

        oscilador.start();
        oscilador.stop(contextoSonidoAtencion.currentTime + 0.35);

    } catch (error) {
        console.warn("No se pudo reproducir la alerta:", error);
    }
}

// Consultar atenciones registradas en Supabase.
async function cargarAtenciones() {
    if (consultaAtencionesEnCurso) return;

    consultaAtencionesEnCurso = true;

    try {
        const { data, error } = await supabasePanel.functions.invoke(
            "consultar-ingresos"
        );

        if (error || !data ||
            !Array.isArray(data.atenciones) ||
            typeof data.totalAtenciones !== "number") {
            console.error("Error al consultar atenciones:", error || data);

            if (!atencionesInicializadas) {
                tablaAtenciones.replaceChildren();

                const fila = document.createElement("tr");
                const celda = document.createElement("td");

                celda.colSpan = 5;
                celda.textContent = "No se pudieron cargar las atenciones.";

                fila.appendChild(celda);
                tablaAtenciones.appendChild(fila);
            }

            return;
        }

        contadorAtenciones.textContent = data.totalAtenciones;

        const atenciones = data.atenciones;
        const nuevosIds = new Set(
            atenciones.map(atencion => String(atencion.id))
        );

        // No sonar por registros anteriores al inicio.
        if (atencionesInicializadas) {
            const hayNuevasAtenciones = atenciones.some(
                atencion => !atencionesConocidas.has(String(atencion.id))
            );

            if (hayNuevasAtenciones) {
                reproducirSonidoAtencion();
            }
        }

        atencionesConocidas = nuevosIds;
        atencionesInicializadas = true;

        tablaAtenciones.replaceChildren();

        if (atenciones.length === 0) {
            const fila = document.createElement("tr");
            const celda = document.createElement("td");

            celda.colSpan = 4;
            celda.textContent = "No hay atenciones registradas hoy.";

            fila.appendChild(celda);
            tablaAtenciones.appendChild(fila);
            return;
        }

        atenciones.forEach(atencion => {
            const fila = document.createElement("tr");

            const hora = new Date(atencion.fecha_hora)
                .toLocaleTimeString("es-CR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Costa_Rica"
                });

            const valores = [
                hora,
                atencion.carnet || "—",
                atencion.actividad,
                "Registrado"
            ];

            valores.forEach(valor => {
                const celda = document.createElement("td");
                celda.textContent = valor;
                fila.appendChild(celda);
            });

            tablaAtenciones.appendChild(fila);
        });

    } catch (error) {
        console.error("Error inesperado en Atención:", error);
    } finally {
        consultaAtencionesEnCurso = false;
    }
}

// Iniciar actualización automática.
function iniciarAtenciones() {
    prepararSonidoAtencion();

    if (intervaloAtenciones !== null) {
        clearInterval(intervaloAtenciones);
    }

    atencionesInicializadas = false;
    atencionesConocidas = new Set();

    cargarAtenciones();

    intervaloAtenciones = setInterval(() => {
        cargarAtenciones();
    }, 10000);
}

// CONSULTAR SOLICITUDES DE CARNÉ

const botonCargarSolicitudes = document.getElementById("botonCargarSolicitudes");

botonCargarSolicitudes.addEventListener("click", cargarSolicitudes);

async function cargarSolicitudes() {
    const tabla = document.getElementById("tablaSolicitudes");

    botonCargarSolicitudes.disabled = true;
    botonCargarSolicitudes.textContent = "Consultando...";

    tabla.innerHTML = `
        <tr>
            <td colspan="5">Cargando solicitudes...</td>
        </tr>
    `;

    const { data, error } = await supabasePanel.functions.invoke(
        "consultar-solicitudes"
    );

    botonCargarSolicitudes.disabled = false;
    botonCargarSolicitudes.textContent = "Actualizar solicitudes";

    if (error || !data?.success) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">No se pudieron cargar las solicitudes.</td>
            </tr>
        `;

        console.error("Error al consultar solicitudes:", error || data?.error);
        return;
    }

    tabla.innerHTML = "";

    if (!data.solicitudes || data.solicitudes.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">No hay solicitudes registradas.</td>
            </tr>
        `;
        return;
    }

    data.solicitudes.forEach((solicitud) => {
        const fila = document.createElement("tr");

        const fecha = new Date(solicitud.creado_en);

        const valores = [
            fecha.toLocaleDateString("es-CR", {
                timeZone: "America/Costa_Rica"
            }),
            solicitud.nombre_completo,
            solicitud.cedula,
            solicitud.estado
        ];

        valores.forEach((valor) => {
            const celda = document.createElement("td");
            celda.textContent = valor ?? "";
            fila.appendChild(celda);
        });

        const celdaAccion = document.createElement("td");
        const boton = document.createElement("button");

        boton.type = "button";
        boton.textContent = "Revisar";
        boton.addEventListener("click", () => {
    abrirFichaSolicitud(solicitud);
});

        celdaAccion.appendChild(boton);
        fila.appendChild(celdaAccion);

        tabla.appendChild(fila);
    });
}
// ABRIR FICHA DE REVISIÓN

function abrirFichaSolicitud(solicitud) {
    document.getElementById("solicitudId").value = solicitud.id;

    document.getElementById("detalleNombre").textContent =
        solicitud.nombre_completo || "No indicado";

    document.getElementById("detalleCedula").textContent =
        solicitud.cedula || "No indicada";

    document.getElementById("detalleNacimiento").textContent =
        solicitud.fecha_nacimiento || "No indicada";

    document.getElementById("detalleCorreo").textContent =
        solicitud.correo || "No indicado";

    document.getElementById("detalleTelefono").textContent =
        solicitud.telefono || "No indicado";

    document.getElementById("detalleDomicilio").textContent =
        solicitud.domicilio || "No indicado";

    document.getElementById("detalleDiscapacidad").textContent =
        solicitud.tiene_discapacidad ? "Sí" : "No";

    document.getElementById("categoriaSolicitud").value =
        solicitud.categoria || "Usuario";

    document.getElementById("subcategoriaSolicitud").value =
        solicitud.subcategoria || "";

    actualizarSubcategoria();

    document.getElementById("mensajeRevision").textContent = "";

    document.getElementById("fichaSolicitud").style.display = "flex";
}


// MOSTRAR U OCULTAR SUBCATEGORÍA

const categoriaSolicitud = document.getElementById("categoriaSolicitud");

categoriaSolicitud.addEventListener("change", actualizarSubcategoria);

function actualizarSubcategoria() {
    const esPersonal = categoriaSolicitud.value === "Funcionario";

    document.getElementById("contenedorSubcategoria").style.display =
        esPersonal ? "block" : "none";

    if (!esPersonal) {
        document.getElementById("subcategoriaSolicitud").value = "";
    }
}


// CERRAR FICHA

document.getElementById("cerrarFicha").addEventListener("click", () => {
    document.getElementById("fichaSolicitud").style.display = "none";
});
// APROBAR SOLICITUD DE CARNÉ

const botonAprobarSolicitud = document.getElementById("aprobarSolicitud");

botonAprobarSolicitud.addEventListener("click", aprobarSolicitud);

async function aprobarSolicitud() {
    const solicitudId = document.getElementById("solicitudId").value;
    const categoria = document.getElementById("categoriaSolicitud").value;
    const subcategoria = document.getElementById("subcategoriaSolicitud").value;

    const mensaje = document.getElementById("mensajeRevision");

    if (categoria === "Funcionario" && !subcategoria) {
        mensaje.textContent = "Seleccioná el tipo de funcionario.";
        return;
    }

    botonAprobarSolicitud.disabled = true;
    botonAprobarSolicitud.textContent = "Procesando...";
    mensaje.textContent = "Registrando aprobación...";

    const { data, error } = await supabasePanel.functions.invoke(
        "aprobar-solicitud-carnet",
        {
            body: {
                solicitud_id: Number(solicitudId),
                categoria: categoria,
                subcategoria: categoria === "Funcionario" ? subcategoria : null
            }
        }
    );

    botonAprobarSolicitud.disabled = false;
    botonAprobarSolicitud.textContent = "Aprobar solicitud";

    if (error || !data?.success) {
        mensaje.textContent =
            data?.error || "No se pudo aprobar la solicitud.";

        console.error("Error al aprobar:", error || data);
        return;
    }

    mensaje.textContent =
        `Solicitud aprobada. Número de carné: ${data.carnet}`;

    await cargarSolicitudes();
}

 // CANCELAR SOLICITUD DE CARNÉ

const botonCancelarSolicitud =
    document.getElementById("cancelarSolicitud");

botonCancelarSolicitud.addEventListener(
    "click",
    cancelarSolicitud
);

async function cancelarSolicitud() {
    const solicitudId =
        document.getElementById("solicitudId").value;

    const mensaje =
        document.getElementById("mensajeRevision");

    const confirmar = confirm(
        "¿Estás seguro de que querés cancelar esta solicitud? " +
        "La solicitud se conservará en el historial."
    );

    if (!confirmar) return;

    botonCancelarSolicitud.disabled = true;
    botonCancelarSolicitud.textContent = "Cancelando...";
    mensaje.textContent = "Procesando cancelación...";

    try {
        const { data, error } =
            await supabasePanel.functions.invoke(
                "cancelar-solicitud-carnet",
                {
                    body: {
                        solicitud_id: Number(solicitudId)
                    }
                }
            );

        if (error || !data?.success) {
            let detalle = data;

            if (error?.context?.json) {
                try {
                    detalle = await error.context.json();
                } catch (_) {}
            }

            mensaje.textContent =
                detalle?.error ||
                "No se pudo cancelar la solicitud.";

            return;
        }

        document.getElementById("fichaSolicitud")
            .style.display = "none";

        await cargarSolicitudes();

        alert("Solicitud cancelada correctamente.");

    } catch (error) {
        console.error("Error al cancelar:", error);
        mensaje.textContent =
            "Ocurrió un error al cancelar la solicitud.";

    } finally {
        botonCancelarSolicitud.disabled = false;
        botonCancelarSolicitud.textContent =
            "Cancelar solicitud";
    }
}

// ==========================================
// MÓDULO DE INCIDENCIAS: CONTROLES DEL FORMULARIO
// ==========================================

const btnNuevaIncidencia = document.getElementById("btnNuevaIncidencia");
const formularioIncidencia = document.getElementById("formularioIncidencia");
const relacionPersona = document.getElementById("relacionPersona");
const datosPersonaIncidencia = document.getElementById("datosPersonaIncidencia");
const btnCancelarIncidencia = document.getElementById("cancelarIncidencia");

btnNuevaIncidencia.addEventListener("click", () => {
    formularioIncidencia.hidden = false;
});


btnCancelarIncidencia.addEventListener("click", () => {
    document.getElementById("tipoIncidencia").value = "";
    document.getElementById("relacionPersona").value = "";
    document.getElementById("carnetIncidencia").value = "";
    document.getElementById("nombrePersonaIncidencia").value = "";
    document.getElementById("descripcionIncidencia").value = "";
    document.getElementById("accionesIncidencia").value = "";
    document.getElementById("mensajeIncidencia").textContent = "";

    datosPersonaIncidencia.hidden = true;
    formularioIncidencia.hidden = true;
});


relacionPersona.addEventListener("change", () => {
    const relacion = relacionPersona.value;

    datosPersonaIncidencia.hidden = relacion === "General";

    if (relacion === "General") {
        document.getElementById("carnetIncidencia").value = "";
        document.getElementById("nombrePersonaIncidencia").value = "";
    }
});

 // ==========================================
 // MÓDULO DE INCIDENCIAS: GUARDAR REGISTRO
 // ==========================================

const botonGuardarIncidencia = document.getElementById("guardarIncidencia");

botonGuardarIncidencia.addEventListener("click", guardarIncidencia);

async function guardarIncidencia() {
    const mensaje = document.getElementById("mensajeIncidencia");

    const tipo = document.getElementById("tipoIncidencia").value;
    const relacion = document.getElementById("relacionPersona").value;
    const carnet = document.getElementById("carnetIncidencia").value.trim();
    const nombre = document.getElementById("nombrePersonaIncidencia").value.trim();
    const descripcion = document.getElementById("descripcionIncidencia").value.trim();
    const acciones = document.getElementById("accionesIncidencia").value.trim();

    if (!tipo || !relacion || !descripcion) {
        mensaje.textContent = "Completá el tipo, la relación y la descripción.";
        return;
    }

    if (relacion === "Con carné" && !carnet) {
        mensaje.textContent = "Ingresá el número de carné.";
        return;
    }

    botonGuardarIncidencia.disabled = true;
    botonGuardarIncidencia.textContent = "Guardando...";
    mensaje.textContent = "Registrando incidencia...";

    try {
        const { data, error } = await supabasePanel.functions.invoke(
            "registrar-incidencia",
            {
                body: {
                    tipo: tipo,
                    relacion_persona: relacion,
                    carnet: relacion === "Con carné" ? carnet : null,
                    nombre_persona: relacion === "General" ? null : nombre,
                    descripcion: descripcion,
                    acciones_realizadas: acciones
                }
            }
        );

        if (error || !data?.success) {
            mensaje.textContent =
                data?.error || "No se pudo guardar la incidencia.";
            console.error("Error al registrar incidencia:", error || data);
            return;
        }

        mensaje.textContent = "¡Incidencia registrada correctamente!";

        document.getElementById("tipoIncidencia").value = "";
        document.getElementById("relacionPersona").value = "";
        document.getElementById("carnetIncidencia").value = "";
        document.getElementById("nombrePersonaIncidencia").value = "";
        document.getElementById("descripcionIncidencia").value = "";
        document.getElementById("accionesIncidencia").value = "";

        datosPersonaIncidencia.hidden = true;

    } catch (error) {
        console.error("Error inesperado:", error);
        mensaje.textContent = "Ocurrió un error al guardar la incidencia.";
    } finally {
        botonGuardarIncidencia.disabled = false;
        botonGuardarIncidencia.textContent = "Guardar incidencia";
    }
}

 // ==========================================
 // MÓDULO DE INCIDENCIAS: CONSULTAR HISTORIAL
 // ==========================================

const historialIncidencias = document.getElementById("historialIncidencias");
const buscarIncidencias = document.getElementById("buscarIncidencias");
const filtroRelacionIncidencia = document.getElementById("filtroRelacionIncidencia");

let incidenciasCargadas = [];

async function cargarIncidencias() {
    historialIncidencias.textContent = "Cargando incidencias...";

    const { data, error } = await supabasePanel.functions.invoke(
        "consultar-incidencias"
    );

    if (error || !data?.success) {
        historialIncidencias.textContent =
            data?.error || "No se pudo cargar el historial.";
        console.error("Error al consultar incidencias:", error || data);
        return;
    }

    incidenciasCargadas = data.incidencias || [];
    mostrarIncidencias();
}


function mostrarIncidencias() {
    const busqueda = buscarIncidencias.value.trim().toLowerCase();
    const filtro = filtroRelacionIncidencia.value;

    const resultados = incidenciasCargadas.filter((incidencia) => {
        const texto = [
            incidencia.tipo,
            incidencia.carnet,
            incidencia.nombre_persona,
            incidencia.descripcion,
            incidencia.acciones_realizadas
        ].join(" ").toLowerCase();

        const coincideBusqueda = texto.includes(busqueda);
        const coincideFiltro =
            !filtro || incidencia.relacion_persona === filtro;

        return coincideBusqueda && coincideFiltro;
    });

    historialIncidencias.replaceChildren();

    if (resultados.length === 0) {
        const mensaje = document.createElement("p");
        mensaje.textContent = "No se encontraron incidencias.";
        historialIncidencias.appendChild(mensaje);
        return;
    }

    const tabla = document.createElement("table");
    tabla.className = "tabla";

    const encabezado = document.createElement("thead");
    const filaEncabezado = document.createElement("tr");

    [
        "Fecha",
        "Tipo de incidencia",
        "Relación",
        "Persona / Carné",
        "Descripción",
        "Detalle"
    ].forEach((titulo) => {
        const th = document.createElement("th");
        th.textContent = titulo;
        filaEncabezado.appendChild(th);
    });

    encabezado.appendChild(filaEncabezado);

    const cuerpo = document.createElement("tbody");

    resultados.forEach((incidencia) => {
        const fila = document.createElement("tr");

        const fecha = new Date(incidencia.fecha_hora)
            .toLocaleString("es-CR");

        let persona = "Incidencia general";

        if (incidencia.relacion_persona === "Con carné") {
            persona = incidencia.carnet;

            if (incidencia.nombre_persona) {
                persona += " · " + incidencia.nombre_persona;
            }
        } else if (incidencia.relacion_persona === "Sin carné") {
            persona = incidencia.nombre_persona || "Sin identificar";
        }

        const valores = [
            fecha,
            incidencia.tipo,
            incidencia.relacion_persona,
            persona,
            incidencia.descripcion
        ];

        valores.forEach((valor) => {
            const celda = document.createElement("td");
            celda.textContent = valor || "—";
            fila.appendChild(celda);
        });

        const celdaDetalle = document.createElement("td");
        const botonDetalle = document.createElement("button");

        botonDetalle.type = "button";
        botonDetalle.textContent = "Ver detalles";

        botonDetalle.addEventListener("click", () => {
            mostrarDetalleIncidencia(incidencia);
        });

        celdaDetalle.appendChild(botonDetalle);
        fila.appendChild(celdaDetalle);

        cuerpo.appendChild(fila);
    });

    tabla.append(encabezado, cuerpo);
    historialIncidencias.appendChild(tabla);
}


buscarIncidencias.addEventListener("input", mostrarIncidencias);
filtroRelacionIncidencia.addEventListener("change", mostrarIncidencias);

// Cargar historial al iniciar el módulo.
cargarIncidencias();

// ==========================================
// MÓDULO DE INCIDENCIAS: VER DETALLES
// ==========================================

function mostrarDetalleIncidencia(incidencia) {
    const ficha = document.getElementById("detalleIncidencia");

    document.getElementById("detalleFecha").textContent =
        new Date(incidencia.fecha_hora).toLocaleString("es-CR");

    document.getElementById("detalleTipo").textContent =
        incidencia.tipo;

    document.getElementById("detalleRelacion").textContent =
        incidencia.relacion_persona;

    let persona = "Incidencia general";

    if (incidencia.relacion_persona === "Con carné") {
        persona = incidencia.carnet;

        if (incidencia.nombre_persona) {
            persona += " · " + incidencia.nombre_persona;
        }
    } else if (incidencia.relacion_persona === "Sin carné") {
        persona = incidencia.nombre_persona || "Persona sin identificar";
    }

    document.getElementById("detallePersona").textContent = persona;

    document.getElementById("detalleDescripcion").textContent =
        incidencia.descripcion;

    document.getElementById("detalleAcciones").textContent =
        incidencia.acciones_realizadas || "No se registraron acciones.";

    ficha.hidden = false;
    ficha.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("cerrarDetalleIncidencia")
    .addEventListener("click", () => {
        document.getElementById("detalleIncidencia").hidden = true;
    });
// DESCARGAR INCIDENCIAS EN EXCEL

const botonDescargarIncidencias = document.getElementById("descargarIncidencias");

botonDescargarIncidencias.addEventListener("click", () => {
    if (incidenciasCargadas.length === 0) {
        alert("No hay incidencias registradas para descargar.");
        return;
    }

    const datosExcel = incidenciasCargadas.map(incidencia => ({
        "Fecha y hora": new Date(incidencia.fecha_hora).toLocaleString("es-CR", {
            timeZone: "America/Costa_Rica"
        }),
        "Tipo de incidencia": incidencia.tipo,
        "Relación con la persona": incidencia.relacion_persona,
        "Carné": incidencia.carnet || "",
        "Nombre de la persona": incidencia.nombre_persona || "",
        "Descripción": incidencia.descripcion,
        "Acciones realizadas": incidencia.acciones_realizadas || ""
    }));

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Incidencias");

    XLSX.writeFile(libro, "Registro_de_incidencias.xlsx");
});

// ==========================================
// MÓDULO DE ADMINISTRACIÓN DE ACTIVIDADES
// ==========================================

const tablaActividades = document.getElementById("tablaActividades");
const botonAgregarActividad = document.getElementById("agregarActividad");
const nombreNuevaActividad = document.getElementById("nombreNuevaActividad");
const mensajeActividad = document.getElementById("mensajeActividad");

async function cargarActividades() {
    tablaActividades.textContent = "Cargando actividades...";

    const { data, error } = await supabasePanel.functions.invoke(
        "administrar-actividades",
        {
            body: { operacion: "consultar" }
        }
    );

    if (error || !data?.success) {
        tablaActividades.textContent =
            data?.error || "No se pudieron cargar las actividades.";

        console.error("Error al consultar actividades:", error || data);
        return;
    }

    mostrarActividades(data.actividades);
}



function mostrarActividades(actividades) {
    tablaActividades.replaceChildren();

    if (!actividades || actividades.length === 0) {
        tablaActividades.textContent = "No hay actividades registradas.";
        return;
    }

    actividades.forEach((actividad) => {
        const fila = document.createElement("tr");

        const celdaNombre = document.createElement("td");
        celdaNombre.textContent = actividad.nombre;

        const celdaEstado = document.createElement("td");
        celdaEstado.textContent = actividad.activa
            ? "Activa"
            : "Inactiva";

        const celdaAccion = document.createElement("td");

        const botonEstado = document.createElement("button");
        botonEstado.type = "button";
        botonEstado.textContent = actividad.activa
            ? "Desactivar"
            : "Activar";

        botonEstado.addEventListener("click", () => {
            cambiarEstadoActividad(
                actividad.id,
                !actividad.activa
            );
        });

        celdaAccion.appendChild(botonEstado);

        // Seleccionar mes.
        const selectorMes = document.createElement("input");
        selectorMes.type = "month";

        const partesFecha = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Costa_Rica",
            year: "numeric",
            month: "2-digit"
        }).formatToParts(new Date());

        const anio = partesFecha.find(
            p => p.type === "year"
        ).value;

        const mesActual = partesFecha.find(
            p => p.type === "month"
        ).value;

        const fechaCostaRica = `${anio}-${mesActual}`;

        selectorMes.value = fechaCostaRica;
        selectorMes.max = fechaCostaRica;

        celdaAccion.appendChild(selectorMes);

        // Descargar PDF de asistencias.
        const botonExcel = document.createElement("button");
        botonExcel.type = "button";
        botonExcel.textContent = "Descargar PDF";

        botonExcel.addEventListener("click", async () => {
            botonExcel.disabled = true;
            botonExcel.textContent = "Preparando PDF...";

            try {
                await descargarAsistencias(
                    actividad.nombre,
                    selectorMes.value
                );
            } finally {
                botonExcel.disabled = false;
                botonExcel.textContent = "Descargar PDF";
            }
        });

        celdaAccion.appendChild(botonExcel);

        // Eliminar actividades inactivas.
        if (!actividad.activa) {
            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.textContent = "Eliminar";

            botonEliminar.addEventListener("click", () => {
                eliminarActividad(actividad.id);
            });

            celdaAccion.appendChild(botonEliminar);
        }

        fila.append(
            celdaNombre,
            celdaEstado,
            celdaAccion
        );

        tablaActividades.appendChild(fila);
    });
}

// Agregar actividad.
async function agregarNuevaActividad() {
    const nombre = nombreNuevaActividad.value.trim();

    if (!nombre) {
        mensajeActividad.textContent =
            "Escribí el nombre de la actividad.";
        return;
    }

    botonAgregarActividad.disabled = true;

    try {
        const { data, error } =
            await supabasePanel.functions.invoke(
                "administrar-actividades",
                {
                    body: {
                        operacion: "agregar",
                        nombre
                    }
                }
            );

        if (error || !data?.success) {
            mensajeActividad.textContent =
                data?.error || "No se pudo agregar la actividad.";
            return;
        }

        nombreNuevaActividad.value = "";
        mensajeActividad.textContent =
            "Actividad agregada correctamente.";

        await cargarActividades();

    } catch (error) {
        console.error("Error al agregar actividad:", error);
        mensajeActividad.textContent =
            "Ocurrió un error al agregar la actividad.";

    } finally {
        botonAgregarActividad.disabled = false;
    }
}

// Activar o desactivar actividad.
async function cambiarEstadoActividad(id, activa) {
    try {
        const { data, error } =
            await supabasePanel.functions.invoke(
                "administrar-actividades",
                {
                    body: {
                        operacion: "cambiar_estado",
                        id,
                        activa
                    }
                }
            );

        if (error || !data?.success) {
            alert(data?.error || "No se pudo cambiar el estado.");
            return;
        }

        await cargarActividades();

    } catch (error) {
        console.error("Error al cambiar estado:", error);
        alert("No se pudo cambiar el estado.");
    }
}

// Eliminar actividad.
async function eliminarActividad(id) {
    const confirmar = confirm(
        "¿Estás seguro de que querés eliminar esta actividad? Esta acción no se puede deshacer."
    );

    if (!confirmar) return;

    try {
        const { data, error } =
            await supabasePanel.functions.invoke(
                "administrar-actividades",
                {
                    body: {
                        operacion: "eliminar",
                        id: Number(id)
                    }
                }
            );

        if (error || !data?.success) {
            alert(data?.error || "No se pudo eliminar la actividad.");
            return;
        }

        alert("Actividad eliminada correctamente.");

        await cargarActividades();

    } catch (error) {
        console.error("Error al eliminar actividad:", error);
        alert("No se pudo eliminar la actividad.");
    }
}

botonAgregarActividad.addEventListener(
    "click",
    agregarNuevaActividad
);


 // Descargar asistencias a PDF con firmas visibles.
async function descargarAsistencias(nombreActividad, mes) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || "")) {
        alert("Seleccioná un mes válido.");
        return;
    }

    try {
        const { data, error } =
            await supabasePanel.functions.invoke(
                "consultar-asistencias",
                {
                    body: {
                        actividad: nombreActividad,
                        mes: mes
                    }
                }
            );

        if (error || !data?.success) {
            let detalle = data?.error;

            if (!detalle && error?.context?.json) {
                try {
                    const respuesta = await error.context.json();
                    detalle = respuesta?.error || respuesta?.message;
                } catch (_) {}
            }

            console.error(
                "Error al consultar asistencias:",
                error || data
            );

            alert(
                detalle ||
                "No se pudieron consultar las asistencias."
            );
            return;
        }

        if (
            !Array.isArray(data.asistencias) ||
            data.asistencias.length === 0
        ) {
            alert(
                "Esta actividad no tiene asistencias registradas en el mes seleccionado."
            );
            return;
        }

        if (
            !window.jspdf ||
            typeof window.jspdf.jsPDF !== "function"
        ) {
            alert(
                "No se cargó jsPDF. Revisá las bibliotecas en panel.html."
            );
            return;
        }

        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a3",
            compress: true
        });

        if (typeof pdf.autoTable !== "function") {
            alert(
                "No se cargó AutoTable. Revisá panel.html."
            );
            return;
        }

        const asistencias = data.asistencias;
        const anchoPagina = pdf.internal.pageSize.getWidth();
        const altoPagina = pdf.internal.pageSize.getHeight();

        // Encabezado del documento.
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);

        pdf.text(
            "Biblioteca Pública de Alajuela Miguel Obregón Lizano",
            anchoPagina / 2,
            13,
            { align: "center" }
        );

        pdf.setFontSize(11);

        pdf.text(
            "Registro mensual de asistencias",
            anchoPagina / 2,
            20,
            { align: "center" }
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);

        pdf.text(
            `Actividad: ${nombreActividad}`,
            8,
            29
        );

        pdf.text(
            `Mes: ${mes}`,
            8,
            35
        );

        pdf.text(
            `Total de asistencias: ${asistencias.length}`,
            8,
            41
        );

        // Diez columnas.
        const encabezados = [[
            "Número de carné",
            "Nombre completo",
            "Cédula",
            "Fecha de nacimiento",
            "Correo electrónico",
            "Tiene discapacidad",
            "Categoría",
            "Actividad",
            "Fecha y hora",
            "Firma"
        ]];

        const filas = asistencias.map(asistencia => {
            let fecha = "";

            if (asistencia.fecha_hora) {
                const fechaObjeto =
                    new Date(asistencia.fecha_hora);

                if (!Number.isNaN(fechaObjeto.getTime())) {
                    fecha = fechaObjeto.toLocaleString(
                        "es-CR",
                        {
                            timeZone: "America/Costa_Rica",
                            hour12: false
                        }
                    );
                }
            }

            return [
                asistencia.carnet || "",
                asistencia.nombre_completo || "",
                asistencia.cedula || "",
                asistencia.fecha_nacimiento || "",
                asistencia.correo || "",
                asistencia.tiene_discapacidad == null
                    ? ""
                    : asistencia.tiene_discapacidad
                        ? "Sí"
                        : "No",
                asistencia.categoria || "",
                asistencia.actividad || nombreActividad,
                fecha,
                ""
            ];
        });

        let firmasConError = 0;

        // Tabla de asistencias.
        pdf.autoTable({
            head: encabezados,
            body: filas,
            startY: 46,
            theme: "grid",

            margin: {
                left: 8,
                right: 8,
                top: 15,
                bottom: 15
            },

            styles: {
                font: "helvetica",
                fontSize: 7,
                cellPadding: 2,
                valign: "middle",
                overflow: "linebreak",
                lineColor: [170, 170, 170],
                lineWidth: 0.15,
                minCellHeight: 19
            },

            headStyles: {
                fillColor: [35, 70, 105],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                halign: "center"
            },

            alternateRowStyles: {
                fillColor: [245, 247, 250]
            },

            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 43 },
                2: { cellWidth: 28 },
                3: { cellWidth: 30 },
                4: { cellWidth: 48 },
                5: { cellWidth: 26 },
                6: { cellWidth: 28 },
                7: { cellWidth: 34 },
                8: { cellWidth: 38 },
                9: { cellWidth: 75 }
            },

            // Insertar firmas dentro de sus celdas.
            didDrawCell: function (datosCelda) {
                if (
                    datosCelda.section !== "body" ||
                    datosCelda.column.index !== 9
                ) {
                    return;
                }

                const asistencia =
                    asistencias[datosCelda.row.index];

                if (!asistencia) return;

                const firma = asistencia.firma;

                if (
                    typeof firma !== "string" ||
                    !/^data:image\/(png|jpe?g);base64,/i.test(firma)
                ) {
                    pdf.setFontSize(7);
                    pdf.setTextColor(100, 100, 100);

                    pdf.text(
                        firma ? "Formato no compatible" : "Sin firma",
                        datosCelda.cell.x + 3,
                        datosCelda.cell.y + 10
                    );

                    pdf.setTextColor(25, 25, 25);

                    if (firma) firmasConError++;
                    return;
                }

                try {
                    const formato =
                        /^data:image\/jpe?g/i.test(firma)
                            ? "JPEG"
                            : "PNG";

                    const propiedades =
                        pdf.getImageProperties(firma);

                    const anchoDisponible =
                        datosCelda.cell.width - 6;

                    const altoDisponible =
                        datosCelda.cell.height - 4;

                    const escala = Math.min(
                        anchoDisponible / propiedades.width,
                        altoDisponible / propiedades.height
                    );

                    const anchoFirma =
                        propiedades.width * escala;

                    const altoFirma =
                        propiedades.height * escala;

                    const posicionX =
                        datosCelda.cell.x +
                        (datosCelda.cell.width - anchoFirma) / 2;

                    const posicionY =
                        datosCelda.cell.y +
                        (datosCelda.cell.height - altoFirma) / 2;

                    pdf.addImage(
                        firma,
                        formato,
                        posicionX,
                        posicionY,
                        anchoFirma,
                        altoFirma
                    );

                } catch (errorFirma) {
                    firmasConError++;

                    console.error(
                        "Error al insertar firma:",
                        errorFirma
                    );

                    pdf.setFontSize(7);
                    pdf.setTextColor(180, 40, 40);

                    pdf.text(
                        "Error de firma",
                        datosCelda.cell.x + 3,
                        datosCelda.cell.y + 10
                    );

                    pdf.setTextColor(25, 25, 25);
                }
            }
        });

        // Número de página.
        const totalPaginas =
            pdf.internal.getNumberOfPages();

        for (
            let numeroPagina = 1;
            numeroPagina <= totalPaginas;
            numeroPagina++
        ) {
            pdf.setPage(numeroPagina);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(90, 90, 90);

            pdf.text(
                `Página ${numeroPagina} de ${totalPaginas}`,
                anchoPagina - 8,
                altoPagina - 7,
                { align: "right" }
            );
        }

        const nombreSeguro = nombreActividad
            .replace(/[\\/:*?"<>|]/g, "_")
            .slice(0, 80);

        pdf.save(
            `Asistencias_${nombreSeguro}_${mes}.pdf`
        );

        if (firmasConError > 0) {
            alert(
                `El PDF se generó, pero ${firmasConError} firma(s) no pudieron mostrarse.`
            );
        }

    } catch (error) {
        console.error(
            "Error al generar PDF de asistencias:",
            error
        );

        alert(
            "Detalle del error: " +
            (error?.message || String(error))
        );
    }
}
