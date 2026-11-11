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
            ingreso.carnet,
            ingreso.actividad,
            "Registrado"
        ];

        valores.forEach((valor) => {
            const celda = document.createElement("td");
            celda.textContent = valor ?? "";
            fila.appendChild(celda);
        });

        tabla.appendChild(fila);
    });
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
        solicitud.categoria || "Asociado";

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
    const esPersonal = categoriaSolicitud.value === "Personal";

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

    if (categoria === "Personal" && !subcategoria) {
        mensaje.textContent = "Seleccioná el tipo de personal.";
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
                subcategoria: categoria === "Personal" ? subcategoria : null
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

    actividades.forEach(actividad => {
        const fila = document.createElement("tr");

        const celdaNombre = document.createElement("td");
        celdaNombre.textContent = actividad.nombre;

        const celdaEstado = document.createElement("td");
        celdaEstado.textContent = actividad.activa ? "Activa" : "Inactiva";

        const celdaAccion = document.createElement("td");

        const botonEstado = document.createElement("button");
        botonEstado.type = "button";
        botonEstado.textContent = actividad.activa
            ? "Desactivar"
            : "Activar";

        botonEstado.addEventListener("click", () => {
            cambiarEstadoActividad(actividad.id, !actividad.activa);
        });

        celdaAccion.appendChild(botonEstado);

        // SELECCIONAR MES
        const selectorMes = document.createElement("input");
        selectorMes.type = "month";

        const partesFecha = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Costa_Rica",
            year: "numeric",
            month: "2-digit"
        }).formatToParts(new Date());

        const anio = partesFecha.find(p => p.type === "year").value;
        const mesActual = partesFecha.find(p => p.type === "month").value;
        const fechaCostaRica = `${anio}-${mesActual}`;

        selectorMes.value = fechaCostaRica;
        selectorMes.max = fechaCostaRica;

        celdaAccion.appendChild(selectorMes);

        // DESCARGAR EXCEL EN TODAS LAS ACTIVIDADES
        const botonExcel = document.createElement("button");
        botonExcel.type = "button";
        botonExcel.textContent = "Descargar Excel";

botonExcel.addEventListener("click", () => {
    descargarAsistencias(
        actividad.nombre,
        selectorMes.value
    );
});

        celdaAccion.appendChild(botonExcel);

        // ELIMINAR SOLO ACTIVIDADES INACTIVAS
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

async function agregarNuevaActividad() {
    const nombre = nombreNuevaActividad.value.trim();

    if (!nombre) {
        mensajeActividad.textContent = "Escribí el nombre de la actividad.";
        return;
    }

    botonAgregarActividad.disabled = true;

    const { data, error } = await supabasePanel.functions.invoke(
        "administrar-actividades",
        {
            body: {
                operacion: "agregar",
                nombre
            }
        }
    );

    botonAgregarActividad.disabled = false;

    if (error || !data?.success) {
        mensajeActividad.textContent =
            data?.error || "No se pudo agregar la actividad.";
        return;
    }

    nombreNuevaActividad.value = "";
    mensajeActividad.textContent = "Actividad agregada correctamente.";

    await cargarActividades();
}

async function cambiarEstadoActividad(id, activa) {
    const { data, error } = await supabasePanel.functions.invoke(
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
}
async function eliminarActividad(id) {
    const confirmar = confirm(
        "¿Estás seguro de que querés eliminar esta actividad? Esta acción no se puede deshacer."
    );

    if (!confirmar) return;

    const { data, error } = await supabasePanel.functions.invoke(
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
}
botonAgregarActividad.addEventListener("click", agregarNuevaActividad);



async function descargarAsistencias(nombreActividad, mes) {
    try {
        if (!mes) {
            alert("Seleccioná un mes válido.");
            return;
        }

        const { data, error } = await supabasePanel.functions.invoke(
            "consultar-asistencias",
            {
                body: {
                    actividad: nombreActividad,
                    mes: mes
                }
            }
        );

        if (error || !data?.success) {
            throw new Error(
                data?.error ||
                error?.message ||
                "No se pudieron consultar las asistencias."
            );
        }

        if (!data.asistencias?.length) {
            alert("Esta actividad no tiene asistencias registradas en el mes seleccionado.");
            return;
        }

        if (typeof ExcelJS === "undefined") {
            throw new Error("No se pudo cargar ExcelJS. Revisá index.html.");
        }

        const libro = new ExcelJS.Workbook();
        const hoja = libro.addWorksheet("Asistencias");

        hoja.columns = [
            { header: "Número de carné", key: "carnet", width: 20 },
            { header: "Nombre completo", key: "nombre", width: 35 },
            { header: "Cédula", key: "cedula", width: 20 },
            { header: "Fecha de nacimiento", key: "nacimiento", width: 22 },
            { header: "Correo electrónico", key: "correo", width: 35 },
            { header: "Teléfono", key: "telefono", width: 20 },
            { header: "Domicilio", key: "domicilio", width: 45 },
            { header: "Tiene discapacidad", key: "discapacidad", width: 22 },
            { header: "Categoría", key: "categoria", width: 25 },
            { header: "Subcategoría", key: "subcategoria", width: 25 },
            { header: "Actividad", key: "actividad", width: 35 },
            { header: "Fecha y hora", key: "fecha", width: 25 },
            { header: "Firma registrada", key: "firma", width: 27 }
        ];

        const encabezado = hoja.getRow(1);
        encabezado.font = {
            bold: true,
            color: { argb: "FFFFFFFF" }
        };
        encabezado.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF17365D" }
        };
        encabezado.height = 28;

        hoja.views = [
            { state: "frozen", ySplit: 1 }
        ];

        for (const asistencia of data.asistencias) {
            const fila = hoja.addRow({
                carnet: asistencia.carnet || "",
                nombre: asistencia.nombre_completo || "",
                cedula: asistencia.cedula || "",
                nacimiento: asistencia.fecha_nacimiento || "",
                correo: asistencia.correo || "",
                telefono: asistencia.telefono || "",
                domicilio: asistencia.domicilio || "",
                discapacidad:
                    asistencia.tiene_discapacidad == null
                        ? ""
                        : asistencia.tiene_discapacidad ? "Sí" : "No",
                categoria: asistencia.categoria || "",
                subcategoria: asistencia.subcategoria || "",
                actividad: asistencia.actividad || "",
                fecha: asistencia.fecha_hora
                    ? new Date(asistencia.fecha_hora).toLocaleString(
                        "es-CR",
                        { timeZone: "America/Costa_Rica" }
                    )
                    : "",
                firma: ""
            });

            fila.height = 50;
            fila.alignment = {
                vertical: "middle"
            };

            if (asistencia.firma) {
                try {
                    const coincidencia = asistencia.firma.match(
                        /^data:image\/(png|jpeg|jpg);base64,/i
                    );

                    if (coincidencia) {
                        const extension =
                            coincidencia[1].toLowerCase() === "jpg"
                                ? "jpeg"
                                : coincidencia[1].toLowerCase();

                        const imagenId = libro.addImage({
                            base64: asistencia.firma,
                            extension: extension
                        });

                        hoja.addImage(imagenId, {
                            tl: {
                                col: 12.15,
                                row: fila.number - 1 + 0.1
                            },
                            ext: {
                                width: 150,
                                height: 55
                            }
                        });
                    }
                } catch (errorFirma) {
                    console.error(
                        "No se pudo insertar una firma:",
                        errorFirma
                    );
                }
            }
        }

        hoja.autoFilter = {
            from: "A1",
            to: "M1"
        };

        const archivo = await libro.xlsx.writeBuffer();

        const blob = new Blob(
            [archivo],
            {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        );

        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");

        const nombreSeguro = nombreActividad
            .replace(/[\\/:*?"<>|]/g, "_")
            .slice(0, 80);

        enlace.href = url;
        enlace.download = `Asistencias_${nombreSeguro}_${mes}.xlsx`;

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

    } catch (error) {
        console.error("Error al generar Excel:", error);
        alert("No se pudo descargar el Excel: " + error.message);
    }
}

        libro,
        `Asistencias_${nombreSeguro}_${mes}.xlsx`
    );
}

