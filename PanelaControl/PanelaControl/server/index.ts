import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startBot } from "./bot";

log("Iniciando servidor Express...", "express");

const app = express();

// Rota de healthcheck - precisa estar disponível imediatamente
app.get('/', (_req, res) => {
  log("Healthcheck chamado", "express");
  res.json({ status: 'ok' });
});

// Configurações básicas
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware de log
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Função para tentar iniciar o servidor com retry
async function startServer(port: number, retries = 3): Promise<void> {
  let attempt = 0;

  while (attempt < retries) {
    try {
      const server = registerRoutes(app);

      await new Promise<void>((resolve, reject) => {
        server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            log(`Porta ${port} em uso, tentativa ${attempt + 1} de ${retries}`, "express");
            server.close();
            reject(error);
          } else {
            reject(error);
          }
        });

        server.listen(port, "0.0.0.0", () => {
          log(`Servidor rodando em http://0.0.0.0:${port}`, "express");
          resolve();
        });

        // Configurar graceful shutdown
        process.on('SIGTERM', () => {
          log("Recebido sinal SIGTERM, iniciando shutdown graceful", "express");
          server.close(() => {
            log("Servidor HTTP fechado", "express");
            process.exit(0);
          });
        });

        process.on('SIGINT', () => {
          log("Recebido sinal SIGINT, iniciando shutdown graceful", "express");
          server.close(() => {
            log("Servidor HTTP fechado", "express");
            process.exit(0);
          });
        });
      });

      // Se chegou aqui, o servidor iniciou com sucesso
      return;
    } catch (error) {
      attempt++;
      if (attempt === retries) {
        throw error;
      }
      // Esperar um pouco antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Função principal de inicialização
async function main() {
  try {
    // Verificar variáveis de ambiente críticas
    log("Verificando variáveis de ambiente...", "express");

    if (!process.env.DATABASE_URL) {
      log("DATABASE_URL não encontrado!", "express");
      throw new Error("URL do banco de dados não encontrada! Configure a variável de ambiente DATABASE_URL.");
    }
    log("✓ DATABASE_URL encontrado", "express");

    // Configurar ambiente
    log("Configurando ambiente...", "express");
    if (app.get("env") === "development") {
      log("Iniciando em modo desenvolvimento", "express");
      const server = registerRoutes(app);
      await setupVite(app, server);
    } else {
      log("Iniciando em modo produção", "express");
      serveStatic(app);
    }

    // Iniciar o servidor HTTP
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
    await startServer(PORT);

    // Iniciar o bot do Discord em background
    if (process.env.DISCORD_TOKEN) {
      log("Iniciando bot do Discord em background...", "express");
      startBot().catch(error => {
        log(`Erro ao iniciar o bot do Discord: ${error}`, "express");
      });
    } else {
      log("DISCORD_TOKEN não encontrado - bot não será iniciado", "express");
    }
  } catch (error) {
    log(`Erro fatal ao iniciar servidor: ${error}`, "express");
    process.exit(1);
  }
}

// Iniciar a aplicação
main().catch((error) => {
  log(`Erro não tratado: ${error}`, "express");
  process.exit(1);
});