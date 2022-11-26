const allStyles = []; // contains all tags providing styling
document.querySelectorAll( 'link[rel=stylesheet], style' ).forEach( ( el, i ) => {
    allStyles.push( el );
});

const allStylesURLBase = allStyles.map( el => {
    const basename = url => {
        const doc = document.implementation.createHTMLDocument( '' ),
              a = doc.createElement( 'a' );
        a.href = url;
        return a.href.replace( a.hash, '' ).replace( a.search, '' ).replace( /([^\/])\/[^\.\/]+(?:\.[^\.\/]+)+$/, '$1/' ); // hash, query, filename
    };
    // style
    if ( el.tagName.toLowerCase() === 'style' ) {
        return basename( window.location.href );
    }
    // link
    if ( !el.href ) { return ''; }
    return basename( el.href );
});

const fetchContent = async url => { // get the content of a .css file by the src url
    const response = await fetch( url );
    if ( !response.ok ) { return ''; }
    return await response.text();
}
const allStylesContent = await Promise.all( allStyles.map( async el => {
    // style
    if ( el.tagName.toLowerCase() === 'style' ) { return el.textContent; }
    // link
    if ( !el.href ) { return ''; }
    return await fetchContent( el.href );

}));

const parseCSS = s => {
    const doc = document.implementation.createHTMLDocument( '' ),
          style = doc.createElement( 'style' );
    style.textContent = s;
    doc.body.appendChild( style );
    return style.sheet.cssRules;
};
const allStylesContentParsed = allStylesContent.map( sc => {
    return parseCSS( sc );
});

const getFirstScreenElements = () => {

    const win = {
        width: ( window.innerWidth || document.documentElement.clientWidth ) + 1,
        height: ( window.innerHeight || document.documentElement.clientHeight ) + 1
    };
    win.height = Math.round( win.height * 1.1 );

    const onFirstScreen = el => {
        const r = el.getBoundingClientRect();
        const s = { top: document.documentElement.scrollTop, left: document.documentElement.scrollLeft };
        return (
            r.top + s.top < win.height &&
            //r.bottom + s.top > 0 &&
            r.left + s.left < win.width //&&
            //r.right + s.left > 0
        );
    };

    let firstScreenElements = [];
    document.body.querySelectorAll( '*' ).forEach( el => {
        if ( !onFirstScreen( el ) ) { return; }
        firstScreenElements.push( el );
    });
    firstScreenElements.push( document.documentElement );
    firstScreenElements.push( document.body );

    return firstScreenElements;
};
let firstScreenElements = getFirstScreenElements();


const filterVisibleCSS = () => {
    let firstScreenCSS = '';

    const iterateRules = ( list, ind ) => {
        let firstScreenCSS = '';
        const fixUrls = url => {
            return url.replace( /url\(('|")?(https?\:\/\/|\/|\/\/|data\:)?/gi, (m, m1, m2) => {
                if ( m2 ) { return m }
                return 'url('+m1+allStylesURLBase[ ind ];
            });
        };
        Object.entries( list ).forEach( entry => {
            const [key, value] = entry;
            if ( value.constructor.name === 'CSSMediaRule' ) {
                const result = iterateRules( value.cssRules );
                firstScreenCSS += result ? '@media ' + value.conditionText + '{' + result + '}' : ''; // ++can unite with similar rules, like CSSSupportsRule
                return;
            }
            if ( value.constructor.name === 'CSSSupportsRule' ) {
                const result = iterateRules( value.cssRules );
                firstScreenCSS += result ? '@supports ' + value.conditionText + '{' + result + '}' : '';
                return;
            }
            if ( value.constructor.name === 'CSSFontFaceRule' ) {
                value.style.src = fixUrls( value.style.src );
                firstScreenCSS += value.cssText;
                return;
            }
            if ( value.constructor.name === 'CSSImportRule' ) {
                return;
                // ++assume, that it is absolute.. for now, as @import is not often used in our projects
                const replaceToken = '{{' + ind + key + '}}'
                firstScreenCSS += replaceToken;
                fetchContent( value.href ).then( t => { firstScreenCSS.replace( replaceToken, t ) } ); // ++parse ++filter
                return;
            }
            if ( value.constructor.name !== 'CSSStyleRule' ) {
                //console.error( 'Not used rule ' + value.constructor.name ); console.log( value );
                return;
            }
            //@charset "UTF-8";

            const isInFirstScreen = Array.prototype.some.call( document.querySelectorAll( value.selectorText.replace( /\s:{1,2}(?:before|after)/gi, ' *' ).replace( /:{1,2}(?:before|after)/gi, '' ).replace(/^[\,\s]+|[\,\s]+$/g, '') ), el => {
                // ++can also separate selectors by , and check each separately and exclude :focus, :hover and other to make everything lighter
                return firstScreenElements.includes( el );
            });
            if ( !isInFirstScreen ) { return; }

            if ( value.style.backgroundImage ) {
                value.style.backgroundImage = fixUrls( value.style.backgroundImage );
            };

            firstScreenCSS += value.cssText;
        });
        return firstScreenCSS;
    };

    allStylesContentParsed.forEach( (s,i) => {
        firstScreenCSS += iterateRules( s, i );
    });

    return firstScreenCSS;
};

const style = document.createElement( 'style' );
document.body.prepend( style );
style.textContent = filterVisibleCSS();

//    await new Promise( resolve => setTimeout( resolve, 5000 ) );

//* it can effect the upper placed elements, if something is vertically centered or aligned by bottom
// remove elementsm which are not on the first screen
firstScreenElements.push( style );
document.body.querySelectorAll( '*' ).forEach( el => {
    if ( firstScreenElements.includes( el ) ) { return; }
    el.remove();
}); //*/
// remove the <style and <link
allStyles.forEach( el => {
    el.remove();
});

// print the styles
const textarea = document.createElement( 'textarea' );
document.body.append( textarea );
textarea.value = style.textContent;
textarea.style = `
display:block;
width:100%;
height:50vh;
`;
textarea.addEventListener( 'click', (e) => {
    e.target.select();
});

// ++add the list to pick which styles to proceed