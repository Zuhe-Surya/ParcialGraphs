# EvaluaGraphQL

Proyecto académico para construir paso a paso una API GraphQL que consulta información pública de Colombia mediante [API Colombia](https://api-colombia.com/).

## Requisitos

- Node.js 20 o superior
- npm

## Instalar y ejecutar

```powershell
npm install
npm run dev
```

Abre `http://localhost:4000` en el navegador para probar las consultas.

## Pruebas automatizadas

Ejecuta todas las pruebas de integración desde la raíz del proyecto:

```powershell
npm test
```

Las pruebas levantan un servidor GraphQL local y una API Colombia simulada; no necesitan internet ni servicios externos.

## Consultas disponibles

```graphql
query {
  saludo
  country {
    name
    officialName
    capital
    area
    population
    currency
    currencyCode
    flags
  }
  departments {
    id
    name
    capital
    municipalityCount
    area
    population
  }
}
```

Busca un departamento por identificador o nombre y consulta sus municipios:

```graphql
query {
  department(id: 2) {
    name
    cities {
      name
      population
      postalCode
    }
  }
}
```

```graphql
query {
  departmentByName(name: "Antioquia") {
    name
    capital
    area
    population
  }
}
```

Busca municipios por nombre parcial. La búsqueda ignora mayúsculas y tildes; por ejemplo, `Bogota` encuentra `Bogotá D.C.`:

```graphql
query {
  searchCities(name: "Bogota") {
    id
    name
    population
    postalCode
    departmentId
  }
}
```

`officialName` se extrae de la descripción de API Colombia, ya que el recurso de país no devuelve un campo separado para el nombre oficial.

## Atracciones turísticas

Consulta las atracciones disponibles o las de un departamento:

```graphql
query {
  touristAttractions {
    id
    name
    description
    images
    latitude
    longitude
    city {
      name
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
}
```

Consulta las atracciones de un municipio por nombre. La búsqueda de la ciudad no distingue mayúsculas ni tildes; si existe la ciudad, pero la API no tiene atracciones para su departamento, la consulta devuelve una lista vacía:

```graphql
query {
  touristAttractionsByCity(cityName: "Medellin") {
    id
    name
    description
    images
    latitude
    longitude
    city {
      name
    }
  }
}
```
