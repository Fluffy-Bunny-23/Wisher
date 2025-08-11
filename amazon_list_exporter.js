(
  function() {
    const items = [];
    document.querySelectorAll('[id^="itemName_"]').forEach(itemElement => {
      const name = itemElement.textContent.trim();
      const link = itemElement.href;

      // Attempt to find a description and price. These might vary greatly
      // depending on the Amazon page structure. This is a basic attempt.
      let description = '';
      let price = '';
      let imageUrl = '';

      // Look for a sibling element that might contain the byline/description
      const closestARow = itemElement.closest('.a-row');
      const bylineElement = closestARow ? closestARow.nextElementSibling : null;
      if (bylineElement && bylineElement.querySelector('[id^="item-byline-"]')) {
        description = bylineElement.querySelector('[id^="item-byline-"]').textContent.trim();
      }

      // Look for price. This is highly dependent on the page structure.
      // Common classes might be 'a-price-whole', 'a-price-fraction', etc.
      // This is a placeholder and might need adjustment.
      const closestSection = itemElement.closest('.a-section, .a-spacing-base');
      let priceElement = null;
      if (closestSection) {
        priceElement = closestSection.querySelector('.a-price .a-offscreen');
      }
      
      if (priceElement) {
        price = priceElement.textContent.trim().replace(/[^\d.]/g, '');
      } else {
        let priceTextElement = null;
        if (closestSection) {
          priceTextElement = closestSection.querySelector('.a-color-price');
        }
        if (priceTextElement) {
          price = priceTextElement.textContent.trim().replace(/[^\d.]/g, '');
        }
      }

      let imageElement = null;
      if (closestSection) {
        // Try more general image selectors common on Amazon product listings
        // Try to find the main product image by its specific data attribute, then fall back to other selectors.
        imageElement = closestSection.querySelector('img[data-a-image-name="landingImage"], img[height="135"][width="135"], img.s-image, img.a-image, img.product-image, img');
      }

      if (imageElement) {
        imageUrl = imageElement.src;
        console.log('Found image element:', imageElement);
        console.log('Extracted imageUrl:', imageUrl);
      }

      items.push({
        name: name,
        description: description,
        link: link,
        price: price,
        imageUrl: imageUrl
      });
    });

    const jsonOutput = JSON.stringify(items, null, 2);
    console.log(jsonOutput);

    // Optional: Provide a way to download the JSON
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amazon_list_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Amazon list data exported to amazon_list_export.json');
  })();