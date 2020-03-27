# term-browser
Terminology browser providing tools to explore the contents of a FHIR-compliant Terminology Service (STU3)

Essentially, the app can be connected to any terminology endpoint compliant with FHIR. This client is currently based on the version 3 (STU3) but should be easily upgradable to v4.

This app may evolve in the future to provide various and more robusted methods to explore the ontologies behind. It is currently developed as a proof-of-concept to practise use of FHIR and evaluate its capabilities.

## NHS Digital and Ontoserver
Initially, the endpoint to be used is the Ontoserver instance provided for proof-of-concept tools by NHS Digital. https://ontoserver.dataproducts.nhs.uk/fhir/

Ontoserver is a registered product of CSIRO. https://ontoserver.csiro.au/

## FHIR
FHIR is a standard for data-sharing in Health-related projects, aiming to enable the interaction between different systems and environments. The Terminology Service provides a base solution to deal with clinical concepts, validation of codes, translation between code systems (e.g. SNOMED CT, ICD-10, etc.).
For more information about FHIR and the Terminology Service consult the official documentation. http://hl7.org/fhir/STU3/

## SNOMED CT
SNOMED Clinical Terms (CT) is a structured clinical vocabulary created to standardise the contents in electronic health record systems (EHR). It is considered the most comprehensive and precise clinical health terminology product in the world. https://digital.nhs.uk/services/terminology-and-classifications/snomed-ct
The development and maintainance is provided by SNOMED International. https://www.snomed.org/

### NHS Digital SNOMED CT browser
A beatiful implementation of a SNOMED CT browser can be found at https://termbrowser.nhs.uk/. It allows the user to explore the hierarchy of the code system and see relations with ICD-10 and OPCS-4 codes. It has similarities with what is intended from our terminology browser in that it allows the navigation between concepts. The main difference is probably the possibility we aim to group several concepts and exporting them for future processing (e.g. for a data request to an external database), or linking it in private deployments with a patient's database (e.g. find individuals following target procedures).
