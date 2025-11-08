(function() {
  console.log('=== AMAZON SINGLE PRODUCT EXTRACTOR ===');

  // Extract product data from the current page
  const productData = {};

  // Extract product name
  const nameSelectors = [
    '#productTitle',
    '.a-size-large.product-title-word-break',
    'h1.a-size-large',
    '[data-cy="title-recipe"]',
    '.product-title-word-break'
  ];

  for (const selector of nameSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      productData.name = element.textContent.trim();
      console.log('✅ Found product name:', productData.name);
      break;
    }
  }

  // Extract product URL (current page)
  productData.link = window.location.href;
  console.log('✅ Product URL:', productData.link);

  // Extract price
  const priceSelectors = [
    '.a-price .a-offscreen',
    '.a-color-price',
    '[data-cy="price-recipe"] .a-price .a-offscreen',
    '.a-price-whole',
    '.priceToPay .a-offscreen',
    '[id*="price"] .a-offscreen',
    '.apexPriceToPay .a-offscreen'
  ];

  for (const selector of priceSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      let priceText = element.textContent.trim();
      // Clean up price text
      priceText = priceText.replace(/[^\d.,]/g, '');
      if (priceText) {
        productData.price = priceText;
        console.log('✅ Found price:', productData.price);
        break;
      }
    }
  }

  // Extract description/byline
  const bylineSelectors = [
    '#bylineInfo',
    '.a-link-normal.contributorNameID',
    '#brand',
    '.a-size-base.a-color-secondary',
    '[data-cy="byline-info"]'
  ];

  for (const selector of bylineSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      productData.description = element.textContent.trim();
      console.log('✅ Found description/byline:', productData.description);
      break;
    }
  }

  // Extract image URL
  const imageSelectors = [
    '#landingImage',
    '#imgBlkFront',
    '.a-dynamic-image',
    '[data-image-index="0"]',
    '.image img'
  ];

  for (const selector of imageSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      let imageUrl = element.src || element.getAttribute('data-old-hires') || element.getAttribute('data-image');

      if (imageUrl && !imageUrl.includes('placeholder') && !imageUrl.includes('spinner') &&
          !imageUrl.includes('loading') && imageUrl.startsWith('http')) {

        // Handle Amazon's dynamic image sizing
        if (imageUrl.includes('_SS135_')) {
          imageUrl = imageUrl.replace('_SS135_', '_SS300_');
        }
        if (imageUrl.includes('._SL')) {
          imageUrl = imageUrl.replace(/\._SL\d+_/, '._SL500_');
        }

        productData.imageUrl = imageUrl;
        console.log('✅ Found image URL:', productData.imageUrl);
        break;
      }
    }
  }

  // If no image found with direct selectors, try finding the main product image
  if (!productData.imageUrl) {
    const allImages = document.querySelectorAll('img');
    for (const img of allImages) {
      const src = img.src;
      if (src && src.includes('media-amazon.com') && !src.includes('placeholder') &&
          !src.includes('spinner') && !src.includes('loading') && src.includes('images/I/')) {
        productData.imageUrl = src;
        console.log('✅ Found image URL (fallback):', productData.imageUrl);
        break;
      }
    }
  }

  // Log the extracted data
  console.log('=== EXTRACTED PRODUCT DATA ===');
  console.log(JSON.stringify(productData, null, 2));

  // Create downloadable JSON file
  try {
    const jsonOutput = JSON.stringify([productData], null, 2); // Wrap in array for consistency with list format
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amazon_single_product_' + new Date().toISOString().slice(0, 10) + '.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ Amazon single product data exported successfully!');
    console.log(`📁 File: amazon_single_product_${new Date().toISOString().slice(0, 10)}.json`);
  } catch (error) {
    console.error('❌ Error creating download:', error);
  }

  // Return the data for further use if needed
  return [productData];
})();
