// Selva
// Auteur : Corentin ROBIN
// Version : 25 septembre 2020
// Mini-librairie pour créer des applications temps-réel avec mise à jour automatique de l'interface

// on étend le prototype des objets HTML pour faciliter la gestion du contenu
HTMLElement.prototype._contentType = function()
{
    if(this.tagName == "INPUT" || this.tagName == "TEXTAREA" || this.tagName == "SELECT" || this.tagName == "PROGRESS")
    {
        if(this.type && (this.type == "checkbox" || this.type == "radio")) return "checked";
        else if(this.type && this.type == "file") return "files";
        else return "value";
    }

    else return "innerHTML";
}

HTMLElement.prototype._setContent = function(content)
{
    this[this._contentType()] = content;
}

HTMLElement.prototype._getContent = function()
{
    // seule exception : le bouton radio ; pour cocher un bouton radio, on utilise checked ; pour récupérer sa valeur, on utilise value
    if(this.type && this.type == "radio") return this.value;
    else return this[this._contentType()];
}

var Selva =
{
    language : undefined,
    languageFolder : undefined,
    languageHasChanged : false,
    text : undefined,
    lastRenderingDuration : 0,
    fastRendering : true,
    toAvoid : ["selva-application", "selva-is-evented", "selva-language", "selva-language-folder"],

    evaluate : function(string)
    {
        return string.replace(/\{(.*?)\}/g,
                        function(string, match)
                        {
                            var result;

                            try
                            {
                                result = eval(match);
                            }

                            catch(error)
                            {
                                result = undefined;
                            }

                            return result;
                        });
    },

    render : function()
    {
        var t0 = performance.now();

        var elements = document.querySelectorAll("*");

        elements.forEach(function(element)
        {
            var attributes = element.attributes;

            if((element.tagName == "INPUT" || element.tagName == "TEXTAREA" || element.tagName == "SELECT") && element.hasAttribute("selva-value"))
            {
                var selvaValue = element.getAttribute("selva-value");

                // si l'attribut value contient exactement "{ *variable *}", on lie l'input à la valeur JavaScript
                if(selvaValue[0] == "{" && selvaValue[selvaValue.length - 1] == "}")
                {
                    // on ajoute l'écouteur une seule fois évidemment
                    if(!element.hasAttribute("selva-is-evented"))
                    {
                        element.addEventListener("input", function(event)
                        {
                            var target = event.target,
                                selvaValue = target.getAttribute("selva-value");

                            var variable = selvaValue.substring(1, selvaValue.length - 1);

                            // on remplace d'éventuels espaces parasites
                            variable = variable.replace(/ /g, "");

                            // la variable peut être globale ou être la propriété d'un object
                            variable = variable.split(/\./g);

                            if(variable.length == 1) window[variable[0]] = this._getContent();
                            else window[variable[0]][variable[1]] = this._getContent();
                        });

                        element.setAttribute("selva-is-evented", "true");
                    }
                }
            }
            
            for(i = 0; i < attributes.length; i++)
            {
                attribute = attributes[i];

                // si c'est un attribut selva, on effectue les remplacements et les évaluations
                if(attribute.name.indexOf("selva-") != -1 && Selva.toAvoid.indexOf(attribute.name) == -1)
                {
                    targetAttribute = attribute.name.split(/-/g)[1];
                    newAttributeValue = Selva.evaluate(attribute.value);

                    if(attribute.name == "selva-value")
                    {
                        if(element.type && element.type == "radio")
                        {
                            if(element.value == newAttributeValue) element.checked = true;
                            else element.checked = false;   
                        }

                        // si le contenu est différent, on change la valeur
                        else if(element._getContent() != newAttributeValue && !(element.type && element.type == "file"))
                        {
                            // on converti la chaîne en booléen pour les boîtes à cocher
                            if(element.type && element.type == "checkbox") newAttributeValue = newAttributeValue == "true";
                            
                            element._setContent(newAttributeValue);
                        }
                    }

                    else if(attribute.name == "selva-text" && Selva.text != undefined)
                    {
                        var text = Selva.text[newAttributeValue];

                        if(element._getContent() != text) element._setContent(text);
                    }

                    else
                    {
                        if(element.getAttribute(targetAttribute) != newAttributeValue) element.setAttribute(targetAttribute, newAttributeValue);
                    }
                }

                else if(attribute.name == "selva-language")
                {
                    var language = Selva.evaluate(attribute.value);

                    if(Selva.language != language)
                    {
                        Selva.language = language;
                        Selva.languageHasChanged = true;
                    }

                    else Selva.languageHasChanged = false;
                }

                else if(attribute.name == "selva-language-folder")
                {
                    var languageFolder = Selva.evaluate(attribute.value);
                    if(Selva.languageFolder != languageFolder) Selva.languageFolder = languageFolder;

                    // on charge la bonne langue si besoin
                    if(Selva.languageHasChanged)
                    {
                        var request = new XMLHttpRequest();
                        request.addEventListener("load", function()
                        {
                            Selva.text = JSON.parse(this.responseText);
                        });
                        request.open("GET", Selva.languageFolder + "/" + Selva.language + ".json");
                        request.send();
                    }
                }
            }
        });

        var t1 = performance.now();

        Selva.lastRenderingDuration = (t1 - t0) / 1000;

        // on réappelle la fonction de rendu le plus vite possible
        if(Selva.fastRendering) requestAnimationFrame(Selva.render);
        else setTimeout(Selva.render, 125);
    }
};

window.addEventListener("load", Selva.render);