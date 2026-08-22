### Quantbit Construction Management

construction management system

### Documentation

- [Functional Application Process Document](docs/functional-application-process.md)
- [Technical Application Process Document](docs/technical-application-process.md)

### Mobile Application Repository

[https://github.com/QuantbitERP/construction-mgmt-sys-mobile](https://github.com/QuantbitERP/construction-mgmt-sys-mobile)

![QR code for the Quantbit Construction Management mobile application repository](docs/qr_mobile.svg)

### Procurex Bundle Repository

[https://github.com/QuantbitERP/ProcurexBundle.git](https://github.com/QuantbitERP/ProcurexBundle.git)

![QR code for the Procurex Bundle repository](docs/qr_procurex.svg)

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench install-app quantbit_construction_management
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/quantbit_construction_management
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
