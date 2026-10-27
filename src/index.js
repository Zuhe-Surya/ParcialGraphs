import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const typeDefs = `#graphql
  type Country {
    id: Int!
    name: String!
    officialName: String
    description: String
    capital: String
    area: Float
    population: Int
    currency: String
    currencyCode: String
    flags: [String!]!
  }

  type City {
    id: Int!
    name: String!
    description: String
    area: Float
    population: Int
    postalCode: String
    departmentId: Int!
  }

  type Department {
    id: Int!
    name: String!
    description: String
    capital: String
    municipalityCount: Int
    area: Float
    population: Int
    cities: [City!]!
    touristAttractions: [TouristAttraction!]!
  }

  type TouristAttraction {
    id: Int!
    name: String!
    description: String
    images: [String!]
    latitude: String
    longitude: String
    cityId: Int
    city: City
  }

  type Query {
    saludo: String!
    country: Country!
    departments: [Department!]!
    department(id: Int!): Department
    departmentByName(name: String!): Department
    searchCities(name: String!): [City!]!
    touristAttractions: [TouristAttraction!]!
    touristAttractionsByCity(cityName: String!): [TouristAttraction!]!
  }
`;

const apiBaseUrl = (
  process.env.API_COLOMBIA_BASE_URL ??
  "https://api-colombia.com/api/v1"
).replace(/\/$/, "");

async function fetchApi(path, { notFoundValue } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    if (response.status === 404 && notFoundValue !== undefined) {
      return notFoundValue;
    }

    throw new Error(
      `API Colombia respondió ${response.status} al consultar ${path}.`,
    );
  }

  return response.json();
}

async function fetchDepartmentTouristAttractions(departmentId) {
  const attractions = await fetchApi(
    `/Department/${departmentId}/touristicattractions`,
    { notFoundValue: [] },
  );

  if (!Array.isArray(attractions)) {
    throw new Error(
      "API Colombia devolvió un formato inesperado para atracciones turísticas.",
    );
  }

  return attractions;
}

async function fetchDepartment(path) {
  const result = await fetchApi(path, { notFoundValue: null });
  if (result === null) {
    return null;
  }

  return Array.isArray(result) ? result[0] ?? null : result;
}

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

async function searchCitiesByName(name) {
  const searchTerm = name.trim();
  if (!searchTerm) {
    throw new Error("Debes indicar el nombre del municipio que quieres buscar.");
  }

  const cities = await fetchApi(
    `/City/search/${encodeURIComponent(searchTerm)}`,
  );
  if (!Array.isArray(cities)) {
    throw new Error("API Colombia devolvió un formato inesperado para municipios.");
  }

  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  return cities.filter(
    (city) =>
      typeof city.name === "string" &&
      normalizeSearchText(city.name).includes(normalizedSearchTerm),
  );
}

async function fetchTouristicAttractionsByCity(cityName) {
  const searchTerm = cityName.trim();
  if (!searchTerm) {
    throw new Error("Debes indicar el nombre de la ciudad que quieres consultar.");
  }

  const normalizedCityName = normalizeSearchText(searchTerm);
  const cities = await searchCitiesByName(searchTerm);
  const city = cities.find(
    (candidate) => normalizeSearchText(candidate.name) === normalizedCityName,
  );

  if (!city) {
    return [];
  }

  const attractions = await fetchDepartmentTouristAttractions(
    city.departmentId,
  );

  return attractions.filter(
    (attraction) => attraction.cityId === city.id,
  );
}

const resolvers = {
  Query: {
    saludo: () => "API GraphQL de Colombia lista para comenzar.",
    country: () => fetchApi("/Country/Colombia"),
    departments: () => fetchApi("/Department"),
    department: (_, { id }) => fetchDepartment(`/Department/${id}`),
    departmentByName: (_, { name }) =>
      fetchDepartment(`/Department/name/${encodeURIComponent(name)}`),
    searchCities: (_, { name }) => searchCitiesByName(name),
    touristAttractions: () => fetchApi("/TouristicAttraction"),
    touristAttractionsByCity: (_, { cityName }) =>
      fetchTouristicAttractionsByCity(cityName),
  },
  Country: {
    officialName: ({ description }) =>
      description?.match(/oficialmente\s+([^,.]+)/i)?.[1] ?? null,
    capital: ({ stateCapital }) => stateCapital,
    area: ({ surface }) => surface,
  },
  Department: {
    capital: ({ cityCapital }) => cityCapital?.name ?? null,
    municipalityCount: ({ municipalities }) => municipalities,
    area: ({ surface }) => surface,
    cities: ({ id }) => fetchApi(`/Department/${id}/cities`),
    touristAttractions: ({ id }) =>
      fetchDepartmentTouristAttractions(id),
  },
  City: {
    area: ({ surface }) => surface,
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { port: Number(process.env.PORT) || 4000 },
});

console.log(`Servidor GraphQL disponible en ${url}`);
