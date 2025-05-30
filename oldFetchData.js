// pokemonDataFetcher.js
// This script fetches Pokémon data from PokeAPI and generates a JavaScript file
// containing an array of all Pokémon in the specified format.

const fs = require('fs'); // Node.js file system module for writing files
const path = require('path'); // Node.js path module for resolving file paths
// REMOVE THIS LINE: const fetch = require('node-fetch'); // No longer needed for Node.js v18+

// Base URL for the PokeAPI
const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2/';


/**
 * Fetches detailed Pokémon data from PokeAPI.
 * It makes two API calls per Pokémon: one for general data and one for species data
 * to determine the generation.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of formatted Pokémon objects.
 */
async function fetchPokemonData() {
  console.log("Starting to fetch list of all Pokémon...");

  // Fetch a list of all Pokémon. Using a high limit to ensure all are retrieved.
  // The API provides a 'count' field in the initial response, but a high limit is safer.
  const allPokemonListResponse = await fetch(
    `${POKEAPI_BASE_URL}pokemon?limit=10000`
  );
  const allPokemonListData = await allPokemonListResponse.json();
  const pokemonUrls = allPokemonListData.results.map((p) => p.url);

  const allPokemon = []; // Array to store the formatted Pokémon data
  let processedCount = 0; // Counter for tracking progress
  const totalCount = pokemonUrls.length; // Total number of Pokémon to process

  console.log(`Found ${totalCount} Pokémon. Starting detailed data fetch...`);

  // Process Pokémon in batches to manage concurrent API requests.
  // This helps prevent hitting API rate limits or overwhelming the system.
  const BATCH_SIZE = 50; // Number of Pokémon to fetch concurrently in each batch
  for (let i = 0; i < totalCount; i += BATCH_SIZE) {
    const batchUrls = pokemonUrls.slice(i, i + BATCH_SIZE); // Get the current batch of URLs

    // Create an array of promises, each fetching data for one Pokémon in the batch
    const batchPromises = batchUrls.map(async (url) => {
      try {
        // Fetch general Pokémon data (id, name, types, height, weight)
        const pokemonResponse = await fetch(url);
        const pokemonData = await pokemonResponse.json();

        // Fetch Pokémon species data (needed to get the generation)
        const speciesResponse = await fetch(pokemonData.species.url);
        const speciesData = await speciesResponse.json();

        // Extract the generation ID from the species data URL
        // Example URL: "https://pokeapi.co/api/v2/generation/1/" -> extracts "1"
        const generationId = parseInt(
          speciesData.generation.url.split("/").slice(-2, -1)[0]
        );

        // Format the fetched data into the desired structure
        const formattedPokemon = {
          id: pokemonData.id,
          // Capitalize the first letter of the Pokémon's name
          name:
            pokemonData.name.charAt(0).toUpperCase() +
            pokemonData.name.slice(1),
          // Capitalize the first letter of each type name
          types: pokemonData.types.map(
            (t) => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)
          ),
          // Convert height from decimetres to meters (1 dm = 0.1 m)
          height: pokemonData.height / 10,
          // Convert weight from hectograms to kilograms (1 hg = 0.1 kg)
          weight: pokemonData.weight / 10,
          generation: generationId,
        };
        processedCount++; // Increment the processed count

        // Log progress every 100 Pokémon or when all are processed
        if (processedCount % 100 === 0 || processedCount === totalCount) {
          console.log(`Processed ${processedCount}/${totalCount} Pokémon...`);
        }
        return formattedPokemon; // Return the successfully formatted Pokémon
      } catch (error) {
        // Log any errors encountered during fetching for a specific Pokémon
        console.error(`Error fetching data for ${url}:`, error.message);
        return null; // Return null for failed fetches so they can be filtered out
      }
    });

    // Wait for all promises in the current batch to resolve
    const batchResults = await Promise.all(batchPromises);
    // Add only successfully fetched and formatted Pokémon to the main array
    allPokemon.push(...batchResults.filter((p) => p !== null));
  }

  // Sort the final array by Pokémon ID to match the order in your sample data
  allPokemon.sort((a, b) => a.id - b.id);

  return allPokemon; // Return the complete list of formatted Pokémon
}

/**
 * Generates the `allPokemonData.js` file with the fetched and formatted data.
 */
async function generatePokemonDataFile() {
  const pokemonData = await fetchPokemonData(); // Fetch the data

  // Construct the content of the JavaScript file.
  // It exports the `allPokemon` array using `module.exports`.
  const fileContent = `const allPokemon = ${JSON.stringify(
    pokemonData,
    null,
    2
  )};\n\nmodule.exports = allPokemon;`;
  // Define the output file path in the current directory
  const filePath = path.join(__dirname, "allPokemonData.js");

  // Write the content to the file
  fs.writeFileSync(filePath, fileContent, "utf8");
  console.log(
    `Successfully generated ${filePath} with ${pokemonData.length} Pokémon entries.`
  );
}

// Execute the main function to start the process
generatePokemonDataFile();

