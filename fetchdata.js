// pokemonDataFetcher.js
// This script fetches comprehensive Pokémon data from PokeAPI and generates a JavaScript file
// containing an array of all Pokémon in a detailed format.
const fs = require("fs"); // Node.js file system module for writing files
const path = require("path"); // Node.js path module for resolving file paths

// Base URL for the PokeAPI
const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2/";

/**
 * Fetches detailed Pokémon data from PokeAPI, including abilities, moves, and evolution.
 * It makes multiple API calls per Pokémon: one for general data, one for species data,
 * and additional calls for evolution chains.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of formatted Pokémon objects.
 */
async function fetchPokemonData() {
  console.log("Starting to fetch list of all Pokémon...");

  // Fetch a list of all Pokémon. Using a high limit to ensure all are retrieved.
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
  const BATCH_SIZE = 50; // Number of Pokémon to fetch concurrently in each batch
  for (let i = 0; i < totalCount; i += BATCH_SIZE) {
    const batchUrls = pokemonUrls.slice(i, i + BATCH_SIZE); // Get the current batch of URLs

    const batchPromises = batchUrls.map(async (url) => {
      try {
        const pokemonResponse = await fetch(url);
        const pokemonData = await pokemonResponse.json();

        const speciesResponse = await fetch(pokemonData.species.url);
        const speciesData = await speciesResponse.json();

        const generationId = parseInt(
          speciesData.generation.url.split("/").slice(-2, -1)[0]
        );

        // --- Fetch Abilities ---
        const abilities = pokemonData.abilities.map(
          (a) =>
            a.ability.name.charAt(0).toUpperCase() + a.ability.name.slice(1)
        );

        // --- Fetch Moves (limiting to a reasonable number, e.g., first 5) ---
        const moves = pokemonData.moves
          .slice(0, 5) // Take the first 5 moves
          .map((m) =>
            m.move.name
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")
          ); // Format move names (e.g., "thunder-shock" -> "Thunder Shock")

        // --- Fetch Evolution Chain ---
        let evolutionChain = [];
        if (speciesData.evolution_chain && speciesData.evolution_chain.url) {
          const evolutionResponse = await fetch(
            speciesData.evolution_chain.url
          );
          const evolutionData = await evolutionResponse.json();

          // Function to traverse the evolution chain
          const getEvolutionSteps = (chainLink) => {
            const evolutions = [];
            let current = chainLink;
            while (current) {
              const idMatch = current.species.url.match(/\/(\d+)\/$/);
              const id = idMatch ? parseInt(idMatch[1]) : null;
              evolutions.push({
                id: id,
                name:
                  current.species.name.charAt(0).toUpperCase() +
                  current.species.name.slice(1),
                image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`, // Construct image URL
              });
              current =
                current.evolves_to.length > 0 ? current.evolves_to[0] : null; // Assuming a linear evolution for simplicity
            }
            return evolutions;
          };
          evolutionChain = getEvolutionSteps(evolutionData.chain);
        }

        // --- Format the fetched data into the desired structure ---
        const formattedPokemon = {
          id: pokemonData.id,
          name:
            pokemonData.name.charAt(0).toUpperCase() +
            pokemonData.name.slice(1),
          types: pokemonData.types.map(
            (t) => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)
          ),
          height: pokemonData.height / 10, // Convert decimetres to meters
          weight: pokemonData.weight / 10, // Convert hectograms to kilograms
          generation: generationId,
          description:
            speciesData.flavor_text_entries
              .find(
                (entry) =>
                  entry.language.name === "en" && entry.version.name === "red"
              )
              ?.flavor_text.replace(/\n/g, " ")
              .replace(/\f/g, " ") || "No description available.", // Get English description from Red version, clean newlines and form feeds
          stats: {
            hp:
              pokemonData.stats.find((s) => s.stat.name === "hp")?.base_stat ||
              0,
            attack:
              pokemonData.stats.find((s) => s.stat.name === "attack")
                ?.base_stat || 0,
            defense:
              pokemonData.stats.find((s) => s.stat.name === "defense")
                ?.base_stat || 0,
            spAttack:
              pokemonData.stats.find((s) => s.stat.name === "special-attack")
                ?.base_stat || 0,
            spDefense:
              pokemonData.stats.find((s) => s.stat.name === "special-defense")
                ?.base_stat || 0,
            speed:
              pokemonData.stats.find((s) => s.stat.name === "speed")
                ?.base_stat || 0,
          },
          abilities: abilities,
          moves: moves,
          evolution: evolutionChain,
        };

        processedCount++; // Increment the processed count

        if (processedCount % 100 === 0 || processedCount === totalCount) {
          console.log(`Processed ${processedCount}/${totalCount} Pokémon...`);
        }
        return formattedPokemon; // Return the successfully formatted Pokémon
      } catch (error) {
        console.error(`Error fetching data for ${url}:`, error.message);
        return null; // Return null for failed fetches so they can be filtered out
      }
    });

    const batchResults = await Promise.all(batchPromises);
    allPokemon.push(...batchResults.filter((p) => p !== null));
  }

  // Sort the final array by Pokémon ID
  allPokemon.sort((a, b) => a.id - b.id);

  return allPokemon; // Return the complete list of formatted Pokémon
}

/**
 * Generates the `allPokemonData.js` file with the fetched and formatted data.
 */
async function generatePokemonDataFile() {
  const pokemonData = await fetchPokemonData(); // Fetch the data

  // Construct the content of the JavaScript file.
  const fileContent = `const allPokemon = ${JSON.stringify(
    pokemonData,
    null,
    2
  )};\n\nmodule.exports = allPokemon;`;
  const filePath = path.join(__dirname, "allPokemonData1.js");

  fs.writeFileSync(filePath, fileContent, "utf8");
  console.log(
    `Successfully generated ${filePath} with ${pokemonData.length} Pokémon entries.`
  );
}

// Execute the main function to start the process
generatePokemonDataFile();
