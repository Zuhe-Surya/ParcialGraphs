import assert from "node:assert/strict";
import { test } from "node:test";
import { executeGraphQL, startTestServer } from "../support/test-server.js";

test("consulta país y departamentos usando fragmentos GraphQL", async (t) => {
  const environment = await startTestServer(async (path) => {
    if (path === "/api/v1/Country/Colombia") {
      return {
        body: {
          id: 1,
          name: "Colombia",
          description:
            "Colombia, oficialmente República de Colombia, es un país de América del Sur.",
          stateCapital: "Bogotá",
          surface: 1_141_748,
          population: 52_235_050,
          currency: "Colombian Peso",
          currencyCode: "COP",
          flags: ["https://example.test/colombia.svg"],
        },
      };
    }

    if (path === "/api/v1/Department") {
      return {
        body: [
          {
            id: 2,
            name: "Antioquia",
            population: 6_500_000,
            municipalities: 125,
            surface: 63_612,
            cityCapital: { name: "Medellín" },
          },
          {
            id: 3,
            name: "Arauca",
            population: 304_978,
            municipalities: 7,
            surface: 23_818,
            cityCapital: { name: "Arauca" },
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
      country {
        ...CountrySummary
      }
      departments {
        ...DepartmentSummary
      }
    }
    fragment CountrySummary on Country {
      id
      name
      officialName
      capital
      area
      population
      currencyCode
      flags
    }
    fragment DepartmentSummary on Department {
      id
      name
      population
      municipalityCount
      area
      capital
    }`,
  );

  assert.deepEqual(result.errors, undefined);
  assert.deepEqual(result.data.country, {
    id: 1,
    name: "Colombia",
    officialName: "República de Colombia",
    capital: "Bogotá",
    area: 1_141_748,
    population: 52_235_050,
    currencyCode: "COP",
    flags: ["https://example.test/colombia.svg"],
  });
  assert.deepEqual(
    result.data.departments.map(({ name, population, municipalityCount, capital }) => ({
      name,
      population,
      municipalityCount,
      capital,
    })),
    [
      {
        name: "Antioquia",
        population: 6_500_000,
        municipalityCount: 125,
        capital: "Medellín",
      },
      {
        name: "Arauca",
        population: 304_978,
        municipalityCount: 7,
        capital: "Arauca",
      },
    ],
  );
  assert.deepEqual(environment.requests, [
    "/api/v1/Country/Colombia",
    "/api/v1/Department",
  ]);
});
