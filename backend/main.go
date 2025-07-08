package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

// TypesenseConfig holds configuration for connecting to Typesense
type TypesenseConfig struct {
	Host           string
	Port           string
	APIKey         string
	Collection     string
	SearchByFields string // Comma-separated fields to search by
}

// TypesenseSearchResponse represents the structure of a Typesense search API response
type TypesenseSearchResponse struct {
	FacetCounts []interface{} `json:"facet_counts"` // Can be complex, use interface{} for simplicity
	Found       int           `json:"found"`
	Hits        []struct {
		Document  map[string]interface{} `json:"document"` // Use map[string]interface{} for flexible document structure
		Highlight map[string]interface{} `json:"highlight,omitempty"`
		TextMatch float64                `json:"text_match,omitempty"`
	} `json:"hits"`
	OutOf         int                    `json:"out_of"`
	Page          int                    `json:"page"`
	RequestParams map[string]interface{} `json:"request_params"`
	SearchTimeMs  int                    `json:"search_time_ms"`
}

var tsConfig TypesenseConfig
var httpClient *http.Client

func init() {
	// Load Typesense configuration from environment variables
	tsConfig = TypesenseConfig{
		Host:           os.Getenv("TYPESENSE_HOST"),
		Port:           os.Getenv("TYPESENSE_PORT"),
		APIKey:         os.Getenv("TYPESENSE_API_KEY"),
		Collection:     os.Getenv("TYPESENSE_COLLECTION_NAME"),
		SearchByFields: os.Getenv("TYPESENSE_SEARCH_BY_FIELDS"),
	}

	// Validate essential configuration
	if tsConfig.Host == "" || tsConfig.Port == "" || tsConfig.APIKey == "" || tsConfig.Collection == "" {
		log.Fatalf("Missing Typesense environment variables. Please set TYPESENSE_HOST, TYPESENSE_PORT, TYPESENSE_API_KEY, TYPESENSE_COLLECTION_NAME.")
	}
	if tsConfig.SearchByFields == "" {
		log.Println("Warning: TYPESENSE_SEARCH_BY_FIELDS is not set. Typesense will use default search fields.")
	}

	// Initialize HTTP client with a timeout
	httpClient = &http.Client{
		Timeout: 10 * time.Second, // 10-second timeout for HTTP requests
	}
}

// corsMiddleware adds CORS headers to responses
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow requests from your React app's origin (e.g., http://localhost:3000)
		// In a production environment, replace "http://localhost:3000" with your actual frontend domain(s)
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Typesense-Api-Key") // Allow Typesense API key header
		w.Header().Set("Access-Control-Max-Age", "86400")                                   // Cache preflight requests for 24 hours

		// Handle preflight requests (OPTIONS method)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Pass control to the next handler in the chain
		next.ServeHTTP(w, r)
	})
}

// searchHandler handles GET requests to /search
func searchHandler(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Query parameter 'q' is required.", http.StatusBadRequest)
		return
	}

	pageStr := r.URL.Query().Get("page")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1 // Default to page 1 if not provided or invalid
	}

	pageSizeStr := r.URL.Query().Get("pageSize")
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 || pageSize > 250 { // Typesense max per_page is 250
		pageSize = 10 // Default to 10 if not provided or invalid
	}

	// Construct Typesense search URL
	typesenseURL := fmt.Sprintf("http://%s:%s/collections/%s/documents/search",
		tsConfig.Host, tsConfig.Port, tsConfig.Collection)

	params := url.Values{}
	params.Add("q", query)
	params.Add("per_page", strconv.Itoa(pageSize))
	params.Add("page", strconv.Itoa(page))
	if tsConfig.SearchByFields != "" {
		params.Add("query_by", tsConfig.SearchByFields)
	}

	fullURL := typesenseURL + "?" + params.Encode()
	log.Printf("Making Typesense request to: %s", fullURL)

	// Create HTTP request to Typesense
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		log.Printf("Error creating Typesense request: %v", err)
		http.Error(w, "Internal server error.", http.StatusInternalServerError)
		return
	}
	req.Header.Add("X-Typesense-Api-Key", tsConfig.APIKey)

	// Execute the request
	resp, err := httpClient.Do(req)
	if err != nil {
		log.Printf("Error making Typesense HTTP request: %v", err)
		http.Error(w, "Failed to connect to search service.", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	// Read response body
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading Typesense response body: %v", err)
		http.Error(w, "Internal server error.", http.StatusInternalServerError)
		return
	}

	// Check for Typesense API errors (e.g., 4xx, 5xx from Typesense)
	if resp.StatusCode != http.StatusOK {
		log.Printf("Typesense API returned non-200 status: %d - %s", resp.StatusCode, string(body))
		// Forward the Typesense error message and status code to the client
		http.Error(w, fmt.Sprintf("Typesense search failed: %s", string(body)), resp.StatusCode)
		return
	}

	// Unmarshal Typesense response
	var tsResponse TypesenseSearchResponse
	if err := json.Unmarshal(body, &tsResponse); err != nil {
		log.Printf("Error unmarshaling Typesense response: %v", err)
		http.Error(w, "Error parsing search results.", http.StatusInternalServerError)
		return
	}

	// Respond to client with Typesense results
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(tsResponse)
}

func main() {
	// Create a new ServeMux (router)
	router := http.NewServeMux()
	// Register the search handler with the router
	router.HandleFunc("/search", searchHandler)

	// Apply the CORS middleware to the router.
	// All requests to routes registered on 'router' will now pass through corsMiddleware.
	handler := corsMiddleware(router)

	// Start the HTTP server
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080" // Default application port
	}
	log.Printf("Starting GoLang search API server on port %s...", port)
	// Listen and serve HTTP requests using the handler (which includes CORS middleware)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
