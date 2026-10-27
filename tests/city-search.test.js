import assert from "node:assert/strict";
import { test } from "node:test";
import { executeGraphQL, startTestServer } from "../support/test-server.js";

test("busca municipios por nombre sin distinguir mayúsculas ni tildes", async (t) => {
  const environment = await startTestServer(async (path) => {
    if (path === "/api/v1/City/search/Bogota") {
      return {
        body: [
          { id: 1, name: "Bogotá D.C.", departmentId: 11 },
          { id: 2, name: "Tunja", departmentId: 15 },
          { id: 3, name: "Bogotá del Norte", departmentId: 11 },
        ],
      };
    }
    if (path === "/api/v1/City/search/MEDellin") {
      return {
        body: [
          { id: 4, name: "Medellín", departmentId: 5 },
          { id: 5, name: "Rionegro", departmentId: 2 },
        ],
      };
    }

    return { status: 404, body: { message: "Ruta de prueba no encontrada." } };
  });
  t.after(() => environment.stop());

  const result = await executeGraphQL(
    environment.endpoint,
    `query {
      bogota: searchCities(name: " Bogota ") {
        id
        name
        departmentId
      }
      medellin: searchCities(name: "MEDellin") {
        name
      }
    }`,
  );

  assert.deepEqual(result.errors, undefined);
  assert.deepEqual(result.data.bogota, [
    { id: 1, name: "Bogotá D.C.", departmentId: 11 },
    { id: 3, name: "Bogotá del Norte", departmentId: 11 },
  ]);
  assert.deepEqual(result.data.medellin, [{ name: "Medellín" }]);
  assert.deepEqual(environment.requests, [
    "/api/v1/City/search/Bogota",
    "/api/v1/City/search/MEDellin",
  ]);
});

test("rechaza búsquedas vacías y comunica errores de API Colombia", async (t) => {
  const environment = await startTestServer(async (path) => {
    if (path === "/api/v1/City/search/Error") {
      return { status: 503, body: { message: "Servicio no disponible." } };
    }
    return { status: 404, body: { message: "Ruta de prueba no encontrada." } };
  });
  t.after(() => environment.stop());

  const emptyResult = await executeGraphQL(
    environment.endpoint,
    '{ searchCities(name: " ") { name } }',
  );
  assert.match(
    emptyResult.errors?.[0]?.message ?? "",
    /Debes indicar el nombre del municipio/,
  );

  const failedResult = await executeGraphQL(
    environment.endpoint,
    '{ searchCities(name: "Error") { name } }',
  );
  assert.match(
    failedResult.errors?.[0]?.message ?? "",
    /API Colombia respondió 503/,
  );
  assert.deepEqual(environment.requests, ["/api/v1/City/search/Error"]);
});
