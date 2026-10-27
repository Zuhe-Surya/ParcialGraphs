import assert from "node:assert/strict";
import { test } from "node:test";
import { executeGraphQL, startTestServer } from "../support/test-server.js";

test("consulta un departamento por ID y nombre, y recupera sus municipios", async (t) => {
  const antioquia = {
    id: 2,
    name: "Antioquia",
    population: 6_500_000,
    municipalities: 2,
    surface: 63_612,
    cityCapital: { name: "Medellín" },
  };
  const environment = await startTestServer(async (path) => {
    if (path === "/api/v1/Department/2") {
      return { body: antioquia };
    }
    if (path === "/api/v1/Department/name/Antioquia") {
      return { body: [antioquia] };
    }
    if (path === "/api/v1/Department/2/cities") {
      return {
        body: [
          {
            id: 87,
            name: "Puerto Nare",
            population: null,
            postalCode: null,
            departmentId: 2,
          },
          {
            id: 88,
            name: "Puerto Triunfo",
            population: 54_000,
            postalCode: "053440",
            departmentId: 2,
          },
        ],
      };
    }

    return { status: 404, body: { message: "Ruta de prueba no encontrada." } };
  });
  t.after(() => environment.stop());

  const result = await executeGraphQL(
    environment.endpoint,
    `query {
      department(id: 2) {
        name
        capital
        municipalityCount
        cities {
          id
          name
          population
          postalCode
          departmentId
        }
      }
      departmentByName(name: "Antioquia") {
        id
        name
      }
    }`,
  );

  assert.deepEqual(result.errors, undefined);
  assert.deepEqual(result.data.department, {
    name: "Antioquia",
    capital: "Medellín",
    municipalityCount: 2,
    cities: [
      {
        id: 87,
        name: "Puerto Nare",
        population: null,
        postalCode: null,
        departmentId: 2,
      },
      {
        id: 88,
        name: "Puerto Triunfo",
        population: 54_000,
        postalCode: "053440",
        departmentId: 2,
      },
    ],
  });
  assert.deepEqual(result.data.departmentByName, {
    id: 2,
    name: "Antioquia",
  });
  assert.deepEqual([...environment.requests].sort(), [
    "/api/v1/Department/2",
    "/api/v1/Department/2/cities",
    "/api/v1/Department/name/Antioquia",
  ].sort());
});

test("devuelve null si la API no encuentra el departamento", async (t) => {
  const environment = await startTestServer(async (path) => {
    if (path === "/api/v1/Department/999") {
      return { status: 404, body: { message: "No encontrado." } };
    }
    return { status: 404, body: { message: "Ruta de prueba no encontrada." } };
  });
  t.after(() => environment.stop());

  const result = await executeGraphQL(
    environment.endpoint,
    "{ department(id: 999) { id name } }",
  );

  assert.equal(result.data.department, null);
  assert.equal(result.errors, undefined);
});
