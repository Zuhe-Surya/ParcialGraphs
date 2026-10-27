import assert from "node:assert/strict";
import { test } from "node:test";
import { executeGraphQL, startTestServer } from "../support/test-server.js";

test("consulta atracciones turísticas y las relaciona con su departamento", async (t) => {
  const attractions = [
    {
      id: 36,
      name: "Hacienda Nápoles",
      description: "Parque temático y santuario de fauna.",
      images: ["https://example.test/hacienda.jpg"],
      latitude: "5.887894",
      longitude: "-74.6418",
      cityId: 88,
      city: {
        id: 88,
        name: "Puerto Triunfo",
        departmentId: 2,
      },
    },
    {
      id: 37,
      name: "Piedra del Peñol",
      description: "Formación rocosa en Guatapé.",
      images: [],
      latitude: "6.221",
      longitude: "-75.182",
      cityId: 89,
      city: {
        id: 89,
        name: "Guatapé",
        departmentId: 2,
      },
    },
  ];
  const environment = await startTestServer(async (path) => {
    if (path === "/api/v1/TouristicAttraction") {
      return { body: attractions };
    }
    if (path === "/api/v1/Department/2") {
      return {
        body: {
          id: 2,
          name: "Antioquia",
          cityCapital: { name: "Medellín" },
        },
      };
    }
    if (path === "/api/v1/Department/2/touristicattractions") {
      return { body: attractions };
    }
    return { status: 404, body: { message: "Ruta de prueba no encontrada." } };
  });
  t.after(() => environment.stop());

  const result = await executeGraphQL(
    environment.endpoint,
    `query {
      touristAttractions {
        id
        name
        images
        latitude
        longitude
        cityId
        city {
          name
          departmentId
        }
      }
      department(id: 2) {
        name
        touristAttractions {
          name
          city {
            name
          }
        }
      }
    }`,
  );

  assert.deepEqual(result.errors, undefined);
  assert.deepEqual(
    result.data.touristAttractions.map(({ id, name, images, city }) => ({
      id,
      name,
      images,
      cityName: city?.name,
    })),
    [
      {
        id: 36,
        name: "Hacienda Nápoles",
        images: ["https://example.test/hacienda.jpg"],
        cityName: "Puerto Triunfo",
      },
      {
        id: 37,
        name: "Piedra del Peñol",
        images: [],
        cityName: "Guatapé",
      },
    ],
  );
  assert.deepEqual(result.data.department, {
    name: "Antioquia",
    touristAttractions: [
      { name: "Hacienda Nápoles", city: { name: "Puerto Triunfo" } },
      { name: "Piedra del Peñol", city: { name: "Guatapé" } },
    ],
  });
  assert.deepEqual([...environment.requests].sort(), [
    "/api/v1/TouristicAttraction",
    "/api/v1/Department/2",
    "/api/v1/Department/2/touristicattractions",
  ].sort());
});

test("obtiene las atracciones de una ciudad por nombre ignorando tildes", async (t) => {
  const environment = await startTestServer(async (path) => {
    if (path === "/api/v1/City/search/Medellin") {
      return {
        body: [
          { id: 91, name: "Rionegro", departmentId: 2 },
          { id: 99, name: "Medellín", departmentId: 2 },
        ],
      };
    }
    if (path === "/api/v1/Department/2/touristicattractions") {
      return {
        body: [
          {
            id: 50,
            name: "Atracción de Medellín",
            cityId: 99,
            city: { id: 99, name: "Medellín", departmentId: 2 },
          },
          {
            id: 51,
            name: "Atracción de Rionegro",
            cityId: 91,
            city: { id: 91, name: "Rionegro", departmentId: 2 },
          },
        ],
      };
    }
    if (path === "/api/v1/City/search/CiudadInexistente") {
      return { body: [] };
    }
    if (path === "/api/v1/City/search/Arauca") {
      return {
        body: [{ id: 143, name: "Arauca", departmentId: 3 }],
      };
    }
    if (path === "/api/v1/Department/3/touristicattractions") {
      return { status: 404, body: { message: "Sin atracciones." } };
    }
    return { status: 404, body: { message: "Ruta de prueba no encontrada." } };
  });
  t.after(() => environment.stop());

  const medellin = await executeGraphQL(
    environment.endpoint,
    `query {
      touristAttractionsByCity(cityName: " Medellin ") {
        id
        name
        city {
          name
        }
      }
    }`,
  );
  const missingCity = await executeGraphQL(
    environment.endpoint,
    '{ touristAttractionsByCity(cityName: "CiudadInexistente") { id } }',
  );
  const cityWithoutAttractions = await executeGraphQL(
    environment.endpoint,
    '{ touristAttractionsByCity(cityName: "Arauca") { id } }',
  );

  assert.deepEqual(medellin.data.touristAttractionsByCity, [
    {
      id: 50,
      name: "Atracción de Medellín",
      city: { name: "Medellín" },
    },
  ]);
  assert.deepEqual(missingCity.data.touristAttractionsByCity, []);
  assert.deepEqual(cityWithoutAttractions.data.touristAttractionsByCity, []);
  assert.deepEqual(environment.requests, [
    "/api/v1/City/search/Medellin",
    "/api/v1/Department/2/touristicattractions",
    "/api/v1/City/search/CiudadInexistente",
    "/api/v1/City/search/Arauca",
    "/api/v1/Department/3/touristicattractions",
  ]);
});
