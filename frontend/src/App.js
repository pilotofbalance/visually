import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Constants ---
const API_BASE_URL = 'http://localhost:8080'; // Your GoLang backend URL
const PAGE_SIZE = 12; // Number of products to fetch per load
const DEBOUNCE_DELAY = 200; // milliseconds

// --- Inline Styles (simple, functional) ---
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f4f4f4',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    color: '#333',
  },
  header: {
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: '30px',
    fontSize: '2.5em',
    fontWeight: 'bold',
  },
  searchInput: {
    width: '100%',
    padding: '12px 15px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    fontSize: '1.1em',
    boxSizing: 'border-box',
    marginBottom: '20px',
  },
  message: {
    textAlign: 'center',
    padding: '20px',
    fontSize: '1.1em',
    color: '#555',
  },
  errorMessage: {
    backgroundColor: '#ffe0e0',
    border: '1px solid #ff9999',
    color: '#cc0000',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '20px',
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease-in-out',
  },
  productCardHover: {
    transform: 'scale(1.03)',
  },
  productImage: {
    width: '100%',
    height: '180px',
    objectFit: 'cover',
    objectPosition: 'center',
  },
  productInfo: {
    padding: '15px',
    flexGrow: 1, // Ensures content pushes to bottom
    display: 'flex',
    flexDirection: 'column',
  },
  productTitle: {
    fontSize: '1.2em',
    fontWeight: '600',
    color: '#333',
    marginBottom: '8px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  productType: {
    fontSize: '0.9em',
    color: '#777',
    marginBottom: '15px',
  },
  priceStockContainer: {
    marginTop: 'auto', // Pushes to the bottom
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  productPrice: {
    fontSize: '1.4em',
    fontWeight: 'bold',
    color: '#007bff',
  },
  stockStatus: {
    fontSize: '0.9em',
    fontWeight: '500',
  },
  stockGreen: { color: '#28a745' },
  stockRed: { color: '#dc3545' },
  stockOrange: { color: '#ffc107' },
  stockBlue: { color: '#007bff' },
  loadingMore: {
    textAlign: 'center',
    padding: '20px',
    fontSize: '1.1em',
    color: '#007bff',
  }
};

// --- Custom Hook for Debouncing ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// --- ProductCard Component ---
const ProductCard = React.forwardRef(({ product }, ref) => { // Use React.forwardRef
  const [isHovered, setIsHovered] = useState(false);

  // Format price from cents (int64) to dollars (float with 2 decimal places)
  const formattedPrice = (product.price / 100).toFixed(2);

  // Determine stock level display
  let stockStatus = 'In Stock';
  let stockStyle = styles.stockGreen;
  if (product.inventoryQuantity === 0) {
    stockStatus = 'Out of Stock';
    stockStyle = styles.stockRed;
  } else if (product.inventoryQuantity > 0 && product.inventoryQuantity < 10) {
    stockStatus = `Low Stock (${product.inventoryQuantity})`;
    stockStyle = styles.stockOrange;
  } else if (product.inventoryQuantity === -1) {
    stockStatus = 'Available (Unlimited)';
    stockStyle = styles.stockBlue;
  }

  // Fallback image in case product.image.src is missing or broken
  const imageUrl = product.image?.src || `https://placehold.co/400x400/E0E0E0/333333?text=No+Image`;

  return (
    <div
      ref={ref} // Attach the ref here
      style={{ ...styles.productCard, ...(isHovered ? styles.productCardHover : {}) }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={imageUrl}
        alt={product.title}
        style={styles.productImage}
        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/400x400/E0E0E0/333333?text=Image+Error`; }}
      />
      <div style={styles.productInfo}>
        <h3 style={styles.productTitle} title={product.title}>
          {product.title}
        </h3>
        <p style={styles.productType}>{product.productType || 'N/A'}</p>
        <div style={styles.priceStockContainer}>
          <span style={styles.productPrice}>${formattedPrice}</span>
          <span style={{ ...styles.stockStatus, ...stockStyle }}>
            {stockStatus}
          </span>
        </div>
      </div>
    </div>
  );
});

// --- App Component ---
function App() {
  const [searchText, setSearchText] = useState('*');
  const debouncedSearchText = useDebounce(searchText, DEBOUNCE_DELAY);
  const [products, setProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true); // To control infinite scroll

  const observer = useRef(); // For Intersection Observer
  const lastProductElementRef = useCallback(node => {
    if (loading) return; // Don't trigger if already loading
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setCurrentPage(prevPage => prevPage + 1);
      }
    }, { threshold: 0.5 }); // Trigger when 50% of the element is visible

    if (node) observer.current.observe(node);
  }, [loading, hasMore]); // Recreate observer if loading or hasMore changes

  const fetchProducts = useCallback(async (query, page, append = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${PAGE_SIZE}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const newProducts = data.hits.map(hit => hit.document);

      if (append) {
        setProducts(prevProducts => [...prevProducts, ...newProducts]);
      } else {
        setProducts(newProducts);
      }

      setTotalHits(data.found);
      // Determine if there are more pages to load
      setHasMore(data.found > (page * PAGE_SIZE));

    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError(err.message || 'An unknown error occurred.');
      setProducts([]); // Clear products on error for new searches
      setTotalHits(0);
      setHasMore(false); // Stop trying to load more
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array means this function is created once

  // Effect for initial search or when debouncedSearchText changes
  useEffect(() => {
    setProducts([]); // Clear products for a new search
    setCurrentPage(1); // Reset to first page
    setHasMore(true); // Assume there's more data for a new search
    // Fetch immediately for empty query or after debounce for text
    fetchProducts(debouncedSearchText, 1, false);
  }, [debouncedSearchText, fetchProducts]);

  // Effect for infinite scroll: fetch more products when currentPage increments
  useEffect(() => {
    if (currentPage > 1) { // Only fetch if page number actually increased (not initial load)
      fetchProducts(debouncedSearchText, currentPage, true); // Append new data
    }
  }, [currentPage, debouncedSearchText, fetchProducts]); // Added debouncedSearchText and fetchProducts

  return (
    <div style={styles.container}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <h1 style={styles.header}>Search</h1>

        {/* Search Input */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search for products..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Loading and Error Messages */}
        {error && (
          <div style={styles.errorMessage} role="alert">
            <strong>Error!</strong> {error}
            <p style={{ fontSize: '0.9em', marginTop: '5px' }}>
              Please ensure your GoLang backend is running on `http://localhost:8080` and Typesense is accessible.
            </p>
          </div>
        )}

        {/* Product Grid */}
        <div style={styles.productGrid}>
          {products.map((product, index) => {
            // Attach ref to the last product for infinite scroll detection
            if (products.length === index + 1) {
              return <ProductCard ref={lastProductElementRef} key={product.id || index} product={product} />;
            }
            return <ProductCard key={product.id || index} product={product} />;
          })}
        </div>

        {/* Loading More Indicator */}
        {loading && products.length > 0 && ( // Show loading more only if some products are already displayed
          <div style={styles.loadingMore}>Loading more products...</div>
        )}

        {/* No Results Found / Initial Message */}
        {!loading && !error && products.length === 0 && debouncedSearchText !== '' && (
          <div style={styles.message}>
            No products found for "{debouncedSearchText}".
          </div>
        )}
        {!loading && !error && products.length === 0 && debouncedSearchText === '' && (
          <div style={styles.message}>
            Start typing to search for products.
          </div>
        )}


        {/* End of results message */}
        {!loading && !error && products.length > 0 && !hasMore && (
          <div style={styles.message}>You've reached the end of the results ({totalHits} products).</div>
        )}
      </div>
    </div>
  );
}

export default App;
