# MinKa
> *Cobra hoy, cosecha mañana*

MinKa es una plataforma de preventa de cosechas agrícolas para pequeños productores que conecta financiamiento directo mediante contratos de escrow multi-release en Stellar. Integra un mecanismo de desembolso escalonado (40% de anticipo para insumos, 30% contra avance y 30% a la entrega final), respaldado por un Fondo Solidario de Emergencia ante desastres climáticos verificables. Además, ofrece un panel de transparencia pública totalmente auditable en blockchain y un modo de demostración interactivo.

## Ejecución del Backend

1. Ingresar al directorio del backend y activar o crear el entorno virtual:
   ```bash
   cd backend
   python -m venv .venv
   # En Windows:
   .venv\Scripts\activate
   # En Linux / macOS:
   source .venv/bin/activate
   ```

2. Instalar las dependencias del proyecto:
   ```bash
   pip install -r requirements.txt
   ```

3. Crear el archivo de configuración local a partir de la plantilla:
   ```bash
   cp .env.example .env
   ```

4. Iniciar el servidor de la API:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## Ejecución del Frontend

1. Ingresar al directorio del frontend e instalar las dependencias:
   ```bash
   cd frontend
   npm install
   ```

2. Configurar la URL de la API (opcional para desarrollo local en puerto 8000):
   ```bash
   cp .env.example .env
   ```

3. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Compilar para producción:
   ```bash
   npm run build
   ```

## Variables de Entorno Requeridas (.env.example)

- `TRUSTLESS_WORK_API_KEY`
- `TRUSTLESS_WORK_BASE_URL`
- `HORIZON_URL`
- `STELLAR_NETWORK`
- `USDC_EMISOR`
- `MODO_DEMO`
- `PLATAFORMA_PUBLIC_KEY`
- `PLATAFORMA_SECRET_KEY`
- `FONDO_PUBLIC_KEY`
- `FONDO_SECRET_KEY`
- `DEMO_PRODUCTOR_SECRET`
- `DEMO_COMPRADOR_SECRET`

