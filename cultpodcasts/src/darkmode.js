(() => {
    if (window.matchMedia('(prefers-color-scheme)').media === 'not all') {
    }
    
    const darkModeToggle = document.querySelector('dark-mode-toggle');
    const manifests = document.querySelectorAll('link[rel="manifest"]');
    const themeColor = document.querySelector('meta[name="theme-color"]');
        
    const toggleTheme = (e) => {    
      const darkModeOn = e.detail.colorScheme === 'dark' ? true : false;        
      manifests.forEach((link) => {               
        link.href = darkModeOn ? link.dataset.hrefDark : link.dataset.hrefLight; 
      });
      themeColor.content = darkModeOn ? 'black' : 'white';    
    };
    document.addEventListener('colorschemechange', toggleTheme);
    toggleTheme({detail: {colorScheme: darkModeToggle.mode}});
  })();
  