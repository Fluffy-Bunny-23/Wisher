(function() {
  const items = [];
  
  // First, let's inspect the DOM structure to understand the layout
  console.log('=== DOM INSPECTION ===');
  const firstItem = document.querySelector('[id^="itemName_"]');
  if (firstItem) {
    console.log('First item element:', firstItem);
    console.log('First item parent:', firstItem.parentElement);
    console.log('First item closest .a-row:', firstItem.closest('.a-row'));
    
    // Look for images in various containers
    const possibleContainers = [
      firstItem.closest('[data-itemid]'),
      firstItem.closest('[data-asin]'),
      firstItem.closest('.a-fixed-left-grid-inner'),
      firstItem.closest('.a-spacing-base'),
      firstItem.closest('.a-section'),
      firstItem.closest('.a-row')
    ];
    
    possibleContainers.forEach((container, index) => {
      if (container) {
        console.log(`Container ${index}:`, container);
        const images = container.querySelectorAll('img');
        console.log(`Images in container ${index}:`, images);
        images.forEach((img, imgIndex) => {
          console.log(`  Image ${imgIndex}:`, img.src, img.alt, img.className);
        });
      }
    });
  }
  console.log('=== END INSPECTION ===\n');
  
  document.querySelectorAll('[id^="itemName_"]').forEach((itemElement, index) => {
    const name = itemElement.textContent.trim();
    const link = itemElement.href;
    
    console.log(`\n--- Processing item ${index + 1}: ${name.substring(0, 40)}... ---`);

    // Initialize variables
    let description = '';
    let price = '';
    let imageUrl = '';

    // Try multiple container strategies
    const containers = [
      itemElement.closest('[data-itemid]'),
      itemElement.closest('[data-asin]'),
      itemElement.closest('.a-fixed-left-grid-inner'),
      itemElement.closest('.a-fixed-left-grid'),
      itemElement.closest('.a-spacing-base'),
      itemElement.closest('.a-section'),
      itemElement.closest('.a-row'),
      itemElement.parentElement?.parentElement,
      itemElement.parentElement?.parentElement?.parentElement
    ].filter(Boolean);

    let itemContainer = null;
    for (const container of containers) {
      if (container && container.querySelector('img')) {
        itemContainer = container;
        console.log('Using container:', container.className || container.tagName);
        break;
      }
    }

    // If no container with images found, use document-wide search
    if (!itemContainer) {
      console.log('No container with images found, searching document...');
      // Try to find images near this item by looking for alt text matches
      const allImages = document.querySelectorAll('img');
      for (const img of allImages) {
        const alt = img.alt?.toLowerCase() || '';
        const nameParts = name.toLowerCase().split(' ').slice(0, 5); // First 5 words
        if (nameParts.some(part => part.length > 3 && alt.includes(part))) {
          itemContainer = img.parentElement;
          console.log('Found matching image by alt text:', img.alt);
          break;
        }
      }
    }

    // Look for description/byline
    const closestARow = itemElement.closest('.a-row');
    if (closestARow) {
      const bylineElement = closestARow.nextElementSibling;
      if (bylineElement && bylineElement.querySelector('[id^="item-byline-"]')) {
        description = bylineElement.querySelector('[id^="item-byline-"]').textContent.trim();
      }
    }

    // Enhanced price extraction
    let priceElement = null;
    const searchContainers = itemContainer ? [itemContainer] : containers;
    
    for (const container of searchContainers) {
      if (!container) continue;
      
      const priceSelectors = [
        '.a-price .a-offscreen',
        '.a-color-price',
        '[data-a-color="price"]',
        '.a-price-whole',
        '.price',
        '[class*="price"]',
        '[id*="price"]'
      ];
      
      for (const selector of priceSelectors) {
        priceElement = container.querySelector(selector);
        if (priceElement && priceElement.textContent.trim()) {
          console.log('Found price with selector:', selector);
          break;
        }
      }
      if (priceElement) break;
    }
    
    if (priceElement) {
      price = priceElement.textContent.trim().replace(/[^\d.,]/g, '');
    }

    // Enhanced image extraction
    let imageElement = null;
    
    if (itemContainer) {
      console.log('Searching for images in container...');
      
      // Get all images in container
      const allImagesInContainer = itemContainer.querySelectorAll('img');
      console.log(`Found ${allImagesInContainer.length} images in container`);
      
      // Try to find the best image
      for (const img of allImagesInContainer) {
        console.log('Checking image:', img.src, 'Alt:', img.alt);
        
        // Skip obviously bad images
        if (!img.src || 
            img.src.includes('placeholder') || 
            img.src.includes('spinner') ||
            img.src.includes('loading') ||
            !img.src.startsWith('http')) {
          continue;
        }
        
        // Prefer images with matching alt text or Amazon media URLs
        if (img.src.includes('media-amazon.com') || 
            img.src.includes('ssl-images-amazon.com') ||
            (img.alt && img.alt.toLowerCase().includes(name.split(' ')[0].toLowerCase()))) {
          imageElement = img;
          console.log('✅ Selected image:', img.src);
          break;
        }
        
        // Fallback to any valid image
        if (!imageElement) {
          imageElement = img;
        }
      }
    }

    // Extract and clean image URL
    if (imageElement) {
      imageUrl = imageElement.src;
      
      // Handle Amazon's dynamic image sizing
      if (imageUrl.includes('_SS135_')) {
        imageUrl = imageUrl.replace('_SS135_', '_SS300_');
      }
      if (imageUrl.includes('._SL')) {
        imageUrl = imageUrl.replace(/\._SL\d+_/, '._SL500_');
      }
      
      console.log('✅ Final image URL:', imageUrl);
    } else {
      console.log('❌ No valid image found');
    }

    // Add item to results
    items.push({
      name: name,
      description: description,
      link: link,
      price: price,
      imageUrl: imageUrl
    });
  });

  // Log results
  console.log(`Found ${items.length} items:`);
  const jsonOutput = JSON.stringify(items, null, 2);
  console.log(jsonOutput);

  // Create downloadable JSON file
  try {
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amazon_list_export_' + new Date().toISOString().slice(0, 10) + '.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ Amazon list data exported successfully!');
    console.log(`📁 File: amazon_list_export_${new Date().toISOString().slice(0, 10)}.json`);
  } catch (error) {
    console.error('❌ Error creating download:', error);
  }

  // Return the data for further use if needed
  return items;
})();